import { qboQuery, qboClient } from './qboClient.js';
import {
  getPaymentsFromCache,
  savePaymentsToCache,
  getEntityFromCache,
  saveEntityToCache,
} from '../config/database.js';


// ── Helper: Retry on 429 with exponential backoff ──
const fetchWithRetry = async (fn, maxRetries = 4) => {
  let delay = 500;
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      const is429 = err?.response?.status === 429;
      if (!is429 || attempt === maxRetries) throw err;
      console.log(`⚠️ 429 — retry ${attempt}/${maxRetries} after ${delay}ms`);
      await new Promise(r => setTimeout(r, delay));
      delay *= 2; // 500 → 1000 → 2000 → 4000ms
    }
  }
};


// ── Helper: Batch processor to avoid 429 rate limit ──
const processBatch = async (items, batchSize = 5, delayMs = 1000, processor) => {
  const results = [];
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(`⏳ Batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`);
    const batchResults = await Promise.allSettled(batch.map(processor));
    results.push(...batchResults);
    if (i + batchSize < items.length) {
      await new Promise(r => setTimeout(r, delayMs));
    }
  }
  return results;
};


const fetchAllRecords = async (accessToken, realmId, entity) => {
  let allRecords = [];
  let startPosition = 1;
  const pageSize = 1000;

  while (true) {
    const query = `SELECT * FROM ${entity} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
    const res = await qboQuery(accessToken, realmId, query);
    const records = res?.[entity] || [];
    allRecords = [...allRecords, ...records];
    if (records.length < pageSize) break;
    startPosition += pageSize;
  }

  return allRecords;
};


const fetchAccountMap = async (accessToken, realmId) => {
  const accounts = await fetchAllRecords(accessToken, realmId, 'Account');
  const map = {};
  for (const acc of accounts) {
    map[acc.Id] = acc.Name || acc.Id;
  }
  return map;
};


// ── AR Overpayments ──
export const fetchAROverpayments = async (accessToken, realmId, startDate, endDate) => {

  // AccountMap aur payments parallel fetch honge
  const accountMapPromise = fetchAccountMap(accessToken, realmId);

  let allPayments = [];

  if (!startDate && !endDate) {
    const cached = await getPaymentsFromCache(realmId);
    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} payments from MongoDB cache (AR)`);
      allPayments = cached;
    } else {
      let startPosition = 1;
      const pageSize = 1000;
      while (true) {
        const query = `SELECT * FROM Payment MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
        const res = await qboQuery(accessToken, realmId, query);
        const records = res?.Payment || [];
        allPayments = [...allPayments, ...records];
        if (records.length < pageSize) break;
        startPosition += pageSize;
      }
      await savePaymentsToCache(realmId, allPayments);
    }
  } else {
    const conditions = [];
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
    const whereClause = ` WHERE ${conditions.join(' AND ')}`;

    let startPosition = 1;
    const pageSize = 1000;
    while (true) {
      const query = `SELECT * FROM Payment${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
      const res = await qboQuery(accessToken, realmId, query);
      const records = res?.Payment || [];
      allPayments = [...allPayments, ...records];
      if (records.length < pageSize) break;
      startPosition += pageSize;
    }
  }

  console.log(`Total Payments fetched: ${allPayments.length}`);

  const accountMap = await accountMapPromise;

  // Promise.all se parallel processing
  const results = (
    await Promise.all(
      allPayments.map(async (p) => {
        if (Number(p.UnappliedAmt) <= 0) return null;

        // Bank: 3-level fallback — undefined kabhi nahi aayega
        const bankName =
          p.DepositToAccountRef?.name ||
          accountMap[p.DepositToAccountRef?.value] ||
          (p.DepositToAccountRef?.value
            ? `Account (${p.DepositToAccountRef.value})`
            : 'Unknown');

        return {
          TXN_ID:          p.Id,
          REFERENCE_NO:    p.PaymentRefNum      || p.Id,
          TYPE:            'Payment',
          DATE:            p.TxnDate            || '',
          ENTITY:          p.CustomerRef?.name  || '',
          BANK:            bankName,
          BANK_ID:         p.DepositToAccountRef?.value || '',
          FOREIGN_BALANCE: p.UnappliedAmt       || 0,
          CURRENCY:        p.CurrencyRef?.value  || '',
          EXCHANGE:        p.ExchangeRate        || 1,
        };
      })
    )
  ).filter(Boolean);

  console.log(`✅ AR Overpayments fetched: ${results.length}`);
  return results;
};


// ── AP Overpayments ──
export const fetchAPOverpayments = async (accessToken, realmId, startDate, endDate) => {
  const results = [];
  const client = qboClient(accessToken, realmId);

  let allBillPayments = [];

  if (!startDate && !endDate) {
    const { BillPaymentCache, CACHE_TTL_MS } = await import('../config/database.js');
    const cutoff = new Date(Date.now() - CACHE_TTL_MS);
    const cached = await BillPaymentCache.find({
      realmId, fetchedAt: { $gt: cutoff },
    }).lean();

    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} bill payments from MongoDB cache (AP)`);
      allBillPayments = cached.map(d => d.data);
    } else {
      let startPosition = 1;
      const pageSize = 1000;
      while (true) {
        const query = `SELECT * FROM BillPayment MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
        const res = await qboQuery(accessToken, realmId, query);
        const records = res?.BillPayment || [];
        allBillPayments = [...allBillPayments, ...records];
        if (records.length < pageSize) break;
        startPosition += pageSize;
      }

      const { saveBillPaymentsToCache } = await import('../config/database.js');
      await saveBillPaymentsToCache(realmId, allBillPayments);
    }
  } else {
    const conditions = [];
    if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
    if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
    const whereClause = ` WHERE ${conditions.join(' AND ')}`;

    let startPosition = 1;
    const pageSize = 1000;
    while (true) {
      const query = `SELECT * FROM BillPayment${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
      const res = await qboQuery(accessToken, realmId, query);
      const records = res?.BillPayment || [];
      allBillPayments = [...allBillPayments, ...records];
      if (records.length < pageSize) break;
      startPosition += pageSize;
    }
  }

  console.log(`✅ BillPayments fetched: ${allBillPayments.length}`);

  // ✅ Batch: 5 at a time, 1000ms delay, retry on 429
  const settled = await processBatch(
    allBillPayments,
    5,
    1000,
    async (bp) => {
      const cacheKey = `BillPaymentDetail_${bp.Id}`;
      let full = await getEntityFromCache(cacheKey, realmId);

      if (!full) {
        // ✅ 429 aaye toh retry karega — exponential backoff ke saath
        const res = await fetchWithRetry(() =>
          client.get(`/billpayment/${bp.Id}?minorversion=75`)
        );
        full = res.data?.BillPayment || {};
        await saveEntityToCache(cacheKey, realmId, full);
      }

      const totalAmt = Number(full.TotalAmt) || 0;
      const lines = full.Line || [];
      let appliedAmt = 0;

      for (const line of lines) {
        for (const lt of (line.LinkedTxn || [])) {
          if (lt.TxnType === 'Bill') {
            appliedAmt += Number(line.Amount) || 0;
          }
        }
      }

      const unappliedAmt = parseFloat((totalAmt - appliedAmt).toFixed(2));
      if (unappliedAmt <= 0.01) return null;

      const payType = full.PayType || '';
      let bankName  = '';
      let bankId    = '';

      if (payType === 'Check') {
        bankId   = full.CheckPayment?.BankAccountRef?.value || '';
        bankName = full.CheckPayment?.BankAccountRef?.name  || '';
      } else if (payType === 'CreditCard') {
        bankId   = full.CreditCardPayment?.CCAccountRef?.value || '';
        bankName = full.CreditCardPayment?.CCAccountRef?.name  || '';
      }

      return {
        TXN_ID:       full.Id,
        REFERENCE_NO: full.DocNumber       || full.Id,
        TYPE:         payType              || 'BillPayment',
        DATE:         full.TxnDate         || '',
        ENTITY:       full.VendorRef?.name || '',
        BANK:         bankName,
        BANK_ID:      bankId,
        OPEN_BALANCE: unappliedAmt,
        CURRENCY:     full.CurrencyRef?.value || '',
        EXCHANGE:     full.ExchangeRate     || 1,
      };
    }
  );

  for (const s of settled) {
    if (s.status === 'fulfilled' && s.value) {
      results.push(s.value);
    } else if (s.status === 'rejected') {
      console.log(`❌ BillPayment error:`, s.reason?.message);
    }
  }

  console.log(`✅ AP Overpayments fetched: ${results.length}`);
  return results;
};