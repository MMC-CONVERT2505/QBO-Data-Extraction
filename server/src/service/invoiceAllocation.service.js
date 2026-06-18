



import { qboQuery, qboClient } from './qboClient.js';
import {
  getPaymentsFromCache,
  savePaymentsToCache,
  getEntityFromCache,
  saveEntityToCache,
} from '../config/database.js';


const fetchAllRecords = async (accessToken, realmId, entity, startDate, endDate) => {
  let allRecords = [];
  let startPosition = 1;
  const pageSize = 1000;

  const conditions = [];
  if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
  if (endDate) conditions.push(`TxnDate <= '${endDate}'`);
  if (entity === 'Payment') conditions.push(`TotalAmt = '0'`);

  const whereClause = conditions.length > 0
    ? ` WHERE ${conditions.join(' AND ')}` : '';

  while (true) {
    const query = `SELECT * FROM ${entity}${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
    const res = await qboQuery(accessToken, realmId, query);
    const records = res?.[entity] || [];
    allRecords = [...allRecords, ...records];
    if (records.length < pageSize) break;
    startPosition += pageSize;
  }

  console.log(`✅ ${entity} fetched: ${allRecords.length}`);
  return allRecords;
};

const getLineExValue = (lineEx, name) => {
  try {
    const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === name);
    const val = entry?.value?.Value;
    return (val !== undefined && val !== null && val !== '') ? val : null;
  } catch { return null; }
};

const getRefFromLineEx = (lineEx) => getLineExValue(lineEx, 'txnReferenceNumber');
const getOpenBalanceFromLineEx = (lineEx) => {
  const val = getLineExValue(lineEx, 'txnOpenBalance');
  return val !== null ? parseFloat(val) : null;
};

const fetchEntityDetail = async (accessToken, realmId, txnId, txnType) => {
  const cacheKey = `Detail_${txnType}_${txnId}`;
  const cached = await getEntityFromCache(cacheKey, realmId);
  if (cached) return cached;

  try {
    const client = qboClient(accessToken, realmId);
    const map = {
      'CreditMemo': `/creditmemo/${txnId}`,
      'Invoice': `/invoice/${txnId}`,
      'JournalEntry': `/journalentry/${txnId}`,
      'Deposit': `/deposit/${txnId}`,
      'Purchase': `/purchase/${txnId}`,
      'Check': `/purchase/${txnId}`,
      'Expense': `/purchase/${txnId}`,
      'CreditCardCredit': `/creditcardcredit/${txnId}`,
    };

    const endpoint = map[txnType];
    if (!endpoint) return { docNumber: txnId, txnDate: '', totalAmt: '' };

    const res = await client.get(`${endpoint}?minorversion=75`);
    const entity = res.data?.CreditMemo || res.data?.Invoice
      || res.data?.JournalEntry || res.data?.Deposit
      || res.data?.Purchase || res.data?.CreditCardCredit || {};

    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
    if (txnType === 'JournalEntry' && !totalAmt) {
      totalAmt = (entity.Line || [])
        .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
        .reduce((s, l) => s + (l.Amount || 0), 0) || '';
    }

    const result = {
      docNumber: entity.DocNumber || txnId,
      txnDate: entity.TxnDate || '',
      totalAmt,
    };

    await saveEntityToCache(cacheKey, realmId, result);
    return result;
  } catch (err) {
    console.log(`❌ Detail ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

const getAppliedAmount = (sEntry, lEntry, sourceGroup, linkedGroup) => {
  if (sourceGroup.length > 1 && linkedGroup.length === 1) {
    return sEntry.line.Amount;
  }
  if (sourceGroup.length === 1 && linkedGroup.length === 1) {
    return getOpenBalanceFromLineEx(sEntry.line.LineEx)
      ?? getOpenBalanceFromLineEx(lEntry.line.LineEx)
      ?? sEntry.line.Amount;
  }
  return getOpenBalanceFromLineEx(lEntry.line.LineEx)
    ?? getOpenBalanceFromLineEx(sEntry.line.LineEx)
    ?? sEntry.line.Amount;
};

const findSubsetMatch = (amounts) => {

  const n = amounts.length;

  for (let targetIdx = 0; targetIdx < n; targetIdx++) {

    const target = amounts[targetIdx];

    for (
      let mask = 1;
      mask < (1 << n);
      mask++
    ) {

      if (mask & (1 << targetIdx))
        continue;

      let sum = 0;
      const subsetIdx = [];

      for (let i = 0; i < n; i++) {

        if (mask & (1 << i)) {
          sum += amounts[i];
          subsetIdx.push(i);
        }
      }

      if (
        Math.abs(sum - target) < 0.01
      ) {
        return {
          targetIdx,
          subsetIdx
        };
      }
    }
  }

  return null;
};

const getARDirection = async (
  accessToken,
  realmId,
  txnId,
  txnType
) => {

  try {

    const client =
      qboClient(
        accessToken,
        realmId
      );

    let endpoint = "";

    if (
      txnType === "Check" ||
      txnType === "Expense" ||
      txnType === "Purchase"
    ) {
      endpoint =
        `/purchase/${txnId}`;
    }
    else if (
      txnType === "Deposit"
    ) {
      endpoint =
        `/deposit/${txnId}`;
    }
    else if (
      txnType === "JournalEntry"
    ) {
      endpoint =
        `/journalentry/${txnId}`;
    }
    else if (
      txnType ===
      "CreditCardCredit"
    ) {
      endpoint =
        `/creditcardcredit/${txnId}`;
    }
    else {
      return null;
    }

    const res =
      await client.get(
        `${endpoint}?minorversion=75`
      );

    const entity =
      res.data?.Purchase ||
      res.data?.Deposit ||
      res.data?.JournalEntry ||
      res.data?.CreditCardCredit;

    if (!entity)
      return null;

    // JE
    if (
      txnType ===
      "JournalEntry"
    ) {

      for (
        const line of
        entity.Line || []
      ) {

        const detail =
          line
            .JournalEntryLineDetail;

        if (
          detail?.AccountRef
            ?.name ===
          "Debtors"
        ) {

          return {
            amount:
              line.Amount,
            direction:
              detail.PostingType ===
                "Debit"
                ? "LINKED"
                : "SOURCE"
          };
        }
      }

      return null;
    }

    // Purchase / Expense / Check
    if (
      txnType === "Check" ||
      txnType === "Expense" ||
      txnType === "Purchase"
    ) {

      const line =
        entity.Line?.find(
          l =>
            l
              .AccountBasedExpenseLineDetail
              ?.AccountRef
              ?.name ===
            "Debtors"
        );

      if (!line)
        return null;

      return {
        amount:
          line.Amount
      };
    }

    // Deposit
    if (
      txnType ===
      "Deposit"
    ) {

      const line =
        entity.Line?.find(
          l =>
            l
              .DepositLineDetail
              ?.AccountRef
              ?.name ===
            "Debtors"
        );

      if (!line)
        return null;

      return {
        amount:
          line.Amount
      };
    }

    // CreditCardCredit
    if (
      txnType ===
      "CreditCardCredit"
    ) {

      return {
        amount:
          entity.TotalAmt || 0
      };
    }

    return null;

  } catch (err) {

    console.log(
      `AR direction error ${txnType} ${txnId}`,
      err.message
    );

    return null;
  }
};

export const fetchInvoiceAllocations = async (accessToken, realmId, startDate, endDate) => {
  const results = [];
  const classCache = {};
  const detailCache = {};
  const validation = [];

  const getDetail = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!detailCache[key]) {
      detailCache[key] = await fetchEntityDetail(accessToken, realmId, txnId, txnType);
    }
    return detailCache[key];
  };

  // ── Payments fetch ──
  let payments = [];
  if (!startDate && !endDate) {
    const cached = await getPaymentsFromCache(realmId);
    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} payments from cache`);
      payments = cached;
    } else {
      payments = await fetchAllRecords(accessToken, realmId, 'Payment', null, null);
      await savePaymentsToCache(realmId, payments);
    }
  } else {
    payments = await fetchAllRecords(accessToken, realmId, 'Payment', startDate, endDate);
  }

  console.log(`✅ Processing ${payments.length} payments`);

  for (const payment of payments) {
    const seenIds = new Set();
    const uniqueLines = [];

    for (const line of (payment.Line || [])) {
      for (const txn of (line.LinkedTxn || [])) {
        if (!seenIds.has(txn.TxnId)) {
          seenIds.add(txn.TxnId);
          uniqueLines.push({ line, txn });
        }
      }
    }

    if (uniqueLines.length <= 1) continue;

    const hasNonInvoice = uniqueLines.some(({ txn }) => txn.TxnType !== 'Invoice');
    if (!hasNonInvoice) continue;

    let sourceGroup = [];
    let linkedGroup = [];

    // RULE 1
    if (uniqueLines.length === 2) {

      linkedGroup = [uniqueLines[0]];
      sourceGroup = [uniqueLines[1]];
    }

    else {

      for (const item of uniqueLines) {

        const txnType =
          item.txn.TxnType;

        // Invoice
        if (txnType === "Invoice") {
          linkedGroup.push(item);
          continue;
        }

        // CreditMemo
        if (txnType === "CreditMemo") {
          sourceGroup.push(item);
          continue;
        }

        const arInfo =
          await getARDirection(
            accessToken,
            realmId,
            item.txn.TxnId,
            txnType
          );

        if (!arInfo)
          continue;

        // Expense / Check
        if (
          txnType === "Expense" ||
          txnType === "Check" ||
          txnType === "Purchase"
        ) {

          if (arInfo.amount >= 0)
            linkedGroup.push(item);
          else
            sourceGroup.push(item);
        }

        // Deposit
        else if (txnType === "Deposit") {

          if (arInfo.amount >= 0)
            sourceGroup.push(item);
          else
            linkedGroup.push(item);
        }

        // CreditCardCredit
        else if (
          txnType ===
          "CreditCardCredit"
        ) {

          if (arInfo.amount >= 0)
            sourceGroup.push(item);
          else
            linkedGroup.push(item);
        }

        // JournalEntry
        else if (
          txnType ===
          "JournalEntry"
        ) {

          if (
            arInfo.direction ===
            "LINKED"
          )
            linkedGroup.push(item);
          else
            sourceGroup.push(item);
        }
      }

      // Classification fail?
      const failedClassification =
        sourceGroup.length === 0 ||
        linkedGroup.length === 0 ||
        uniqueLines.length !==
        (
          sourceGroup.length +
          linkedGroup.length
        );

      if (failedClassification) {

        const amounts =
          uniqueLines.map(
            x => Number(
              x.line.Amount || 0
            )
          );

        const subsetMatch =
          findSubsetMatch(amounts);

        if (subsetMatch) {

          linkedGroup =
            subsetMatch.subsetIdx.map(
              idx =>
                uniqueLines[idx]
            );

          sourceGroup = [
            uniqueLines[
            subsetMatch.targetIdx
            ]
          ];

        } else {

          linkedGroup =
            [uniqueLines[0]];

          sourceGroup =
            uniqueLines.slice(1);
        }
      }
    }
    validation.push({
      paymentId: payment.Id,
      txns: uniqueLines.length,
      source: sourceGroup.length,
      linked: linkedGroup.length,
      expectedRows:
        sourceGroup.length *
        linkedGroup.length
    });
    // ── Build rows ──
    // =========================
// FIFO ALLOCATION
// =========================

if (
  sourceGroup.length > 0 &&
  linkedGroup.length > 0
) {

  const sourcePool =
    sourceGroup.map(s => ({

      entry: s,

      remaining:
        getOpenBalanceFromLineEx(
          s.line.LineEx
        ) ??
        s.line.Amount
    }));

  const linkedPool =
    linkedGroup.map(l => ({

      entry: l,

      remaining:
        getOpenBalanceFromLineEx(
          l.line.LineEx
        ) ??
        l.line.Amount
    }));

  let sourceIndex = 0;

  for (const linked of linkedPool) {

    while (
      linked.remaining > 0 &&
      sourceIndex < sourcePool.length
    ) {

      const source =
        sourcePool[sourceIndex];

      const applied =
        Math.min(
          linked.remaining,
          source.remaining
        );

      const sEntry =
        source.entry;

      const lEntry =
        linked.entry;

      const sRef =
        await getDetail(
          sEntry.txn.TxnId,
          sEntry.txn.TxnType
        );

      const lRef =
        await getDetail(
          lEntry.txn.TxnId,
          lEntry.txn.TxnType
        );

      results.push({

        PAYMENT_ID:
          payment.Id,

        REFERENCE_NO:
          payment.PaymentRefNum ||
          payment.Id,

        NAME:
          payment.CustomerRef?.name || '',

        ALLOCATION_DATE:
          payment.TxnDate || '',

        CREDIT_NOTE_ID:
          sEntry.txn.TxnId,

        CREDIT_NOTE_NO:
          getRefFromLineEx(
            sEntry.line.LineEx
          ) ||
          sRef?.docNumber ||
          sEntry.txn.TxnId,

        LINKED_REF_NO:
          getRefFromLineEx(
            lEntry.line.LineEx
          ) ||
          lRef?.docNumber ||
          lEntry.txn.TxnId,

        LINKED_TXN_ID:
          lEntry.txn.TxnId,

        APPLIED_AMOUNT:
          applied,

        CREDIT_LINK_TYPE:
          sEntry.txn.TxnType,

        LINKED_TYPE:
          lEntry.txn.TxnType,

        TOTAL:
          sRef?.totalAmt || ''
      });

      linked.remaining -= applied;
      source.remaining -= applied;

      if (
        source.remaining <= 0.01
      ) {
        sourceIndex++;
      }
    }
  }
} else {
      for (const { line, txn } of uniqueLines) {
        const ref = await getDetail(txn.TxnId, txn.TxnType);
        const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;
        results.push({
          PAYMENT_ID: payment.Id,
          REFERENCE_NO: payment.PaymentRefNum || payment.Id,
          NAME: payment.CustomerRef?.name || '',
          ALLOCATION_DATE: payment.TxnDate || '',
          CREDIT_NOTE_ID: '',
          CREDIT_NOTE_NO: '',
          LINKED_REF_NO: refNo,
          LINKED_TXN_ID: txn.TxnId,
          APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE: txn.TxnType,
          TOTAL: '',
        });
      }
    }
  }
  console.log(
    "========== VALIDATION =========="
  );

  console.table(validation);
  console.log(`✅ Final invoice allocation records: ${results.length}`);
  return results;
};