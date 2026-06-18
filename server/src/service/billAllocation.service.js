// import { qboQuery, qboClient } from './qboClient.js';
// import {
//   getBillPaymentsFromCache,
//   saveBillPaymentsToCache,
//   getEntityFromCache,
//   saveEntityToCache,
// } from '../config/database.js';

// const fetchAllRecords = async (accessToken, realmId, entity, startDate, endDate) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;

//   const conditions = [];
//   if (startDate) conditions.push(`TxnDate >= '${startDate}'`);
//   if (endDate) conditions.push(`TxnDate <= '${endDate}'`);
//   const whereClause = conditions.length > 0
//     ? ` WHERE ${conditions.join(' AND ')}`
//     : '';

//   while (true) {
//     const query = `SELECT * FROM ${entity}${whereClause} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.[entity] || [];
//     allRecords = [...allRecords, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }

//   console.log(`✅ ${entity} fetched: ${allRecords.length}`);
//   return allRecords;
// };

// const getRefFromLineEx = (lineEx) => {
//   try {
//     const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === 'txnReferenceNumber');
//     const val = entry?.value?.Value;
//     return (val && val.trim() !== '') ? val : null;
//   } catch { return null; }
// };

// const getOpenBalanceFromLineEx = (lineEx) => {
//   try {
//     const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === 'txnOpenBalance');
//     return entry ? parseFloat(entry.value.Value) : null;
//   } catch { return null; }
// };

// const fetchEntityDetail = async (accessToken, realmId, txnId, txnType) => {
//   const cacheKey = `${txnType}_${txnId}`;
//   const cached = await getEntityFromCache(cacheKey, realmId);
//   if (cached) return cached;

//   try {
//     const client = qboClient(accessToken, realmId);
//     const endpointMap = {
//       'VendorCredit': `/vendorcredit/${txnId}`,
//       'Bill': `/bill/${txnId}`,
//       'JournalEntry': `/journalentry/${txnId}`,
//       'Deposit': `/deposit/${txnId}`,
//       'Purchase': `/purchase/${txnId}`,
//       'Check': `/purchase/${txnId}`,
//       'CreditCardCredit': `/creditcardcredit/${txnId}`,
//       'Expense': `/purchase/${txnId}`,
//     };

//     const endpoint = endpointMap[txnType];
//     if (!endpoint) return { docNumber: txnId, txnDate: '', totalAmt: '' };

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.VendorCredit
//       || res.data?.Bill
//       || res.data?.JournalEntry
//       || res.data?.Deposit
//       || res.data?.Purchase
//       || res.data?.CreditCardCredit
//       || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const lines = entity.Line || [];
//       totalAmt = lines
//         .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
//         .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     const result = {
//       docNumber: entity.DocNumber || txnId,
//       txnDate: entity.TxnDate || '',
//       totalAmt: totalAmt,
//     };

//     await saveEntityToCache(cacheKey, realmId, result);
//     return result;

//   } catch (err) {
//     console.log(`❌ ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };






// const getAppliedAmount = (sEntry, lEntry, sourceGroup, linkedGroup) => {
//   // ✅ Multiple sources, single linked → each source ka apna amount
//   if (sourceGroup.length > 1 && linkedGroup.length === 1) {
//     return sEntry.line.Amount;
//   }

//   // ✅ Single source, single linked
//   if (sourceGroup.length === 1 && linkedGroup.length === 1) {
//     return getOpenBalanceFromLineEx(sEntry.line.LineEx)
//       ?? getOpenBalanceFromLineEx(lEntry.line.LineEx)
//       ?? sEntry.line.Amount;
//   }

//   // ✅ Multiple sources, multiple linked → existing logic
//   return getOpenBalanceFromLineEx(lEntry.line.LineEx)
//     ?? getOpenBalanceFromLineEx(sEntry.line.LineEx)
//     ?? sEntry.line.Amount;
// };

// const getAPDirection = async (
//   accessToken,
//   realmId,
//   txnId,
//   txnType
// ) => {

//   try {

//     const client =
//       qboClient(accessToken, realmId);

//     let endpoint = "";

//     if (
//       txnType === "Check" ||
//       txnType === "Expense" ||
//       txnType === "Purchase"
//     ) {
//       endpoint = `/purchase/${txnId}`;
//     }
//     else if (txnType === "Deposit") {
//       endpoint = `/deposit/${txnId}`;
//     }
//     else if (txnType === "JournalEntry") {
//       endpoint = `/journalentry/${txnId}`;
//     }
//     else if (txnType === "CreditCardCredit") {
//       endpoint = `/creditcardcredit/${txnId}`;
//     }
//     else {
//       return null;
//     }

//     const res =
//       await client.get(
//         `${endpoint}?minorversion=75`
//       );

//     const entity =
//       res.data?.Purchase ||
//       res.data?.Deposit ||
//       res.data?.JournalEntry ||
//       res.data?.CreditCardCredit;

//     if (!entity)
//       return null;

//     // Journal Entry
//     if (txnType === "JournalEntry") {

//       for (const line of entity.Line || []) {

//         const detail =
//           line.JournalEntryLineDetail;

//         if (
//           detail?.AccountRef?.name ===
//           "Accounts Payable (A/P)"
//         ) {

//           return {
//             amount: line.Amount,
//             direction:
//               detail.PostingType === "Debit"
//                 ? "LINKED"
//                 : "SOURCE"
//           };
//         }
//       }

//       return null;
//     }

//     // Purchase / Check / Expense
//     const amount =
//       entity.TotalAmt ||
//       entity.TotalAmount ||
//       0;

//     return { amount };

//   } catch (err) {

//     console.log(
//       `AP direction error ${txnType} ${txnId}`,
//       err.message
//     );

//     return null;
//   }
// };

// export const fetchBillAllocations = async (accessToken, realmId, startDate, endDate) => {
//   const results = [];
//   let skippedSingleTxn = 0;
//   let skippedOnlyBill = 0;
//   let skippedNoGroups = 0;

//   const entityCache = {};
//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       entityCache[key] = await fetchEntityDetail(accessToken, realmId, txnId, txnType);
//     }
//     return entityCache[key];
//   };

//   // ── BillPayment fetch — MongoDB cache ya QBO ──
//   let billPayments = [];
//   if (!startDate && !endDate) {
//     const cached = await getBillPaymentsFromCache(realmId);
//     if (cached.length > 0) {
//       console.log(`⚡ ${cached.length} bill payments from MongoDB cache`);
//       billPayments = cached;
//     } else {
//       billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment', null, null);
//       await saveBillPaymentsToCache(realmId, billPayments);
//     }
//   } else {
//     billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment', startDate, endDate);
//   }

//   console.log(`✅ BillPayments to process: ${billPayments.length}`);

//   for (const bp of billPayments) {
//     const lines = bp.Line || [];

//     // ── Unique txns collect karo ──
//     const seenIds = new Set();
//     const uniqueLines = [];
//     for (const line of lines) {
//       for (const txn of (line.LinkedTxn || [])) {
//         if (!seenIds.has(txn.TxnId)) {
//           seenIds.add(txn.TxnId);
//           uniqueLines.push({ line, txn });
//         }
//       }
//     }

//     // ── Skip: empty ya single txn ──
//     if (uniqueLines.length <= 1) {
//       console.log(
//         "SINGLE TXN",
//         bp.Id,
//         uniqueLines[0]?.txn?.TxnType,
//         uniqueLines[0]?.txn?.TxnId
//       );
//       skippedSingleTxn++;
//       continue;
//     }

//     // ── Skip: sirf Bill linked hain ──
//     const hasNonBill = uniqueLines.some(({ txn }) => txn.TxnType !== 'Bill');
//     if (!hasNonBill) {
//       skippedOnlyBill++;
//       continue;
//     }

//     let sourceGroup = [];
//     let linkedGroup = [];

//     // RULE 1
//     if (uniqueLines.length === 2) {

//       linkedGroup = [uniqueLines[0]];
//       sourceGroup = [uniqueLines[1]];
//     }
//     else {

//       for (const item of uniqueLines) {

//         const txnType = item.txn.TxnType;

//         // Bill fixed linked
//         if (txnType === "Bill") {
//           linkedGroup.push(item);
//           continue;
//         }

//         // VendorCredit fixed source
//         if (txnType === "VendorCredit") {
//           sourceGroup.push(item);
//           continue;
//         }

//         const apInfo =
//           await getAPDirection(
//             accessToken,
//             realmId,
//             item.txn.TxnId,
//             txnType
//           );

//         if (!apInfo)
//           continue;

//         // Check / Expense
//         if (
//           txnType === "Check" ||
//           txnType === "Expense" ||
//           txnType === "Purchase"
//         ) {

//           if (apInfo.amount >= 0)
//             sourceGroup.push(item);
//           else
//             linkedGroup.push(item);
//         }

//         // Deposit
//         else if (txnType === "Deposit") {

//           if (apInfo.amount >= 0)
//             linkedGroup.push(item);
//           else
//             sourceGroup.push(item);
//         }

//         // CreditCardCredit
//         else if (
//           txnType === "CreditCardCredit"
//         ) {

//           if (apInfo.amount >= 0)
//             linkedGroup.push(item);
//           else
//             sourceGroup.push(item);
//         }

//         // JournalEntry
//         else if (
//           txnType === "JournalEntry"
//         ) {

//           if (
//             apInfo.direction === "LINKED"
//           )
//             linkedGroup.push(item);
//           else
//             sourceGroup.push(item);
//         }
//       }
//     }

//     if (
//       sourceGroup.length === 0 ||
//       linkedGroup.length === 0
//     ) {
//       skippedNoGroups++;
//       continue;
//     }
//     continue;
//     // ── Allocation rows ──
//     for (const sEntry of sourceGroup) {
//       const sRef = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
//       const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

//       for (const lEntry of linkedGroup) {
//         const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//         const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//         const appliedAmount = getAppliedAmount(sEntry, lEntry, sourceGroup, linkedGroup);

//         results.push({
//           PAYMENT_ID: bp.Id,
//           REFERENCE_NO: bp.DocNumber || bp.Id,
//           NAME: bp.VendorRef?.name || '',
//           ALLOCATION_DATE: bp.TxnDate || '',
//           CREDIT_NOTE_ID: sEntry.txn.TxnId,
//           CREDIT_NOTE_NO: sRefNo,
//           LINKED_REF_NO: lRefNo,
//           LINKED_TXN_ID: lEntry.txn.TxnId,
//           APPLIED_AMOUNT: appliedAmount,
//           CREDIT_LINK_TYPE: sEntry.txn.TxnType,
//           LINKED_TYPE: lEntry.txn.TxnType,
//           TOTAL: sRef?.totalAmt || '',
//         });
//       }
//     }
//   }
//   console.log({
//     totalBillPayments: billPayments.length,
//     skippedSingleTxn,
//     skippedOnlyBill,
//     skippedNoGroups,
//     finalRecords: results.length
//   });
//   console.log(`✅ Final bill allocation records: ${results.length}`);
//   return results;
// };





import { qboQuery, qboClient } from './qboClient.js';
import {
  getBillPaymentsFromCache,
  saveBillPaymentsToCache,
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
  const whereClause = conditions.length > 0
    ? ` WHERE ${conditions.join(' AND ')}`
    : '';

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

const getRefFromLineEx = (lineEx) => {
  try {
    const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === 'txnReferenceNumber');
    const val = entry?.value?.Value;
    return (val && val.trim() !== '') ? val : null;
  } catch { return null; }
};

const getOpenBalanceFromLineEx = (lineEx) => {
  try {
    const entry = (lineEx?.any || []).find(nv => nv?.value?.Name === 'txnOpenBalance');
    return entry ? parseFloat(entry.value.Value) : null;
  } catch { return null; }
};

const fetchEntityDetail = async (accessToken, realmId, txnId, txnType) => {
  const cacheKey = `${txnType}_${txnId}`;
  const cached = await getEntityFromCache(cacheKey, realmId);
  if (cached) return cached;

  try {
    const client = qboClient(accessToken, realmId);
    const endpointMap = {
      'VendorCredit': `/vendorcredit/${txnId}`,
      'Bill': `/bill/${txnId}`,
      'JournalEntry': `/journalentry/${txnId}`,
      'Deposit': `/deposit/${txnId}`,
      'Purchase': `/purchase/${txnId}`,
      'Check': `/purchase/${txnId}`,
      'CreditCardCredit': `/creditcardcredit/${txnId}`,
      'Expense': `/purchase/${txnId}`,
    };

    const endpoint = endpointMap[txnType];
    if (!endpoint) return { docNumber: txnId, txnDate: '', totalAmt: '' };

    const res = await client.get(`${endpoint}?minorversion=75`);
    const entity = res.data?.VendorCredit
      || res.data?.Bill
      || res.data?.JournalEntry
      || res.data?.Deposit
      || res.data?.Purchase
      || res.data?.CreditCardCredit
      || {};

    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
    if (txnType === 'JournalEntry' && !totalAmt) {
      const lines = entity.Line || [];
      totalAmt = lines
        .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
        .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    const result = {
      docNumber: entity.DocNumber || txnId,
      txnDate: entity.TxnDate || '',
      totalAmt: totalAmt,
    };

    await saveEntityToCache(cacheKey, realmId, result);
    return result;

  } catch (err) {
    console.log(`❌ ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

// ── AP account resolution ──
// Account display names are arbitrary per company ("Accounts Payable",
// "A/P", "Trade Creditors", custom-renamed accounts, etc.), so they can't
// be used to reliably identify the AP account. AccountType is the fixed,
// non-renamable identifier ("Accounts Payable" enum value), but it's only
// exposed on the Account entity itself — never on a transaction line's
// AccountRef. So we resolve the realm's AP account id(s) once via a
// direct Account query and match lines against that id set.
const isAPAccountName = (name) =>
  typeof name === 'string' && name.toLowerCase().includes('accounts payable');

const apAccountIdCache = {};

const getAPAccountIds = async (accessToken, realmId) => {
  if (apAccountIdCache[realmId]) return apAccountIdCache[realmId];
  try {
    const query = `SELECT Id, Name, AccountType FROM Account WHERE AccountType = 'Accounts Payable'`;
    const res = await qboQuery(accessToken, realmId, query);
    const accounts = res?.Account || [];
    const ids = new Set(accounts.map(a => String(a.Id)));
    apAccountIdCache[realmId] = ids;
    console.log('AP ACCOUNT IDS RESOLVED:', accounts.map(a => `${a.Name} (${a.Id})`));
    if (ids.size === 0) {
      console.log('⚠ No "Accounts Payable" AccountType found for this realm — falling back to name matching only.');
    }
    return ids;
  } catch (err) {
    console.log('❌ Failed to resolve AP account ids, falling back to name matching only:', err.message);
    return new Set();
  }
};

// Id match is authoritative; name match is a best-effort fallback only.
const isAPLine = (accountRef, apAccountIds) =>
  apAccountIds?.has(String(accountRef?.value)) || isAPAccountName(accountRef?.name);

// ── getAPDirection ──
// Returns { postingType: 'Debit' | 'Credit', amount } describing how the
// linked transaction's AP line affects the AP balance, or null if no AP
// line is found on the entity. Business rule (applied uniformly by the
// caller): Debit = Source, Credit = Linked.
//
// Purchase/Check/Expense/CreditCardCredit don't carry an explicit
// PostingType field the way JournalEntry lines do, so direction is
// derived from: the entity-level `Credit` flag for Purchase/Check/Expense
// (true = Credit), and the AP line's own amount sign for CreditCardCredit
// and Deposit (no equivalent flag exists on those types). These two are
// the parts most worth confirming against real payloads for this realm.
const getAPDirection = async (accessToken, realmId, txnId, txnType, apAccountIds) => {
  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';

    if (txnType === 'Purchase' || txnType === 'Check' || txnType === 'Expense') {
      endpoint = `/purchase/${txnId}`;
    } else if (txnType === 'Deposit') {
      endpoint = `/deposit/${txnId}`;
    } else if (txnType === 'JournalEntry') {
      endpoint = `/journalentry/${txnId}`;
    } else if (txnType === 'CreditCardCredit') {
      endpoint = `/creditcardcredit/${txnId}`;
    } else {
      return null;
    }

    const res = await client.get(`${endpoint}?minorversion=75`);

    const entity =
      res.data?.Purchase ||
      res.data?.Deposit ||
      res.data?.JournalEntry ||
      res.data?.CreditCardCredit ||
      null;

    if (!entity) {
      console.log('⚠ getAPDirection: entity not found in response for', txnType, txnId);
      return null;
    }

    // ---- JournalEntry: PostingType is explicit on the line ----
    if (txnType === 'JournalEntry') {
      for (const line of entity.Line || []) {
        const detail = line.JournalEntryLineDetail;
        if (isAPLine(detail?.AccountRef, apAccountIds)) {
          return { postingType: detail.PostingType, amount: line.Amount || 0 };
        }
      }
      return null;
    }

    // ---- Purchase / Check / Expense: check both line-detail shapes ----
    if (txnType === 'Purchase' || txnType === 'Check' || txnType === 'Expense') {
      for (const line of entity.Line || []) {
        const accountRef =
          line.AccountBasedExpenseLineDetail?.AccountRef ||
          line.ItemBasedExpenseLineDetail?.AccountRef;
        if (isAPLine(accountRef, apAccountIds)) {
          const postingType = entity.Credit === true ? 'Credit' : 'Debit';
          return { postingType, amount: line.Amount || 0 };
        }
      }
      return null;
    }

    // ---- CreditCardCredit: same line shapes as Purchase, no Credit flag ----
    if (txnType === 'CreditCardCredit') {
      for (const line of entity.Line || []) {
        const accountRef =
          line.AccountBasedExpenseLineDetail?.AccountRef ||
          line.ItemBasedExpenseLineDetail?.AccountRef;
        if (isAPLine(accountRef, apAccountIds)) {
          const postingType = line.Amount < 0 ? 'Debit' : 'Credit';
          return { postingType, amount: line.Amount || 0 };
        }
      }
      return null;
    }

    // ---- Deposit: AP lives under DepositLineDetail ----
    if (txnType === 'Deposit') {
      for (const line of entity.Line || []) {
        const accountRef = line.DepositLineDetail?.AccountRef;
        if (isAPLine(accountRef, apAccountIds)) {
          const postingType = line.Amount < 0 ? 'Debit' : 'Credit';
          return { postingType, amount: line.Amount || 0 };
        }
      }
      return null;
    }

    return null;
  } catch (err) {
    console.log(`AP direction error ${txnType} ${txnId}`, err.message);
    return null;
  }
};

// ── Rule 4 helper: subset-sum amount matching ──
const findSubsetMatchingAmount = (entries, targetAmount, tolerance = 0.01) => {
  const n = entries.length;
  if (n === 0) return null;

  for (let mask = 1; mask < (1 << n); mask++) {
    let sum = 0;
    const subset = [];
    for (let i = 0; i < n; i++) {
      if (mask & (1 << i)) {
        sum += Math.abs(entries[i].line.Amount);
        subset.push(entries[i]);
      }
    }
    if (Math.abs(sum - Math.abs(targetAmount)) <= tolerance) {
      return subset;
    }
  }
  return null;
};

// ── Rule 4: amount-matching fallback ──
const amountMatchingFallback = (uniqueLines) => {
  const sorted = [...uniqueLines].sort(
    (a, b) => Math.abs(b.line.Amount) - Math.abs(a.line.Amount)
  );

  for (let i = 0; i < sorted.length; i++) {
    const candidate = sorted[i];
    const rest = sorted.filter((_, idx) => idx !== i);
    const subset = findSubsetMatchingAmount(rest, candidate.line.Amount);
    if (subset && subset.length > 0) {
      return {
        linkedGroup: [candidate],
        sourceGroup: subset,
      };
    }
  }
  return null;
};

// ── Rule 5: FIFO allocation between linkedGroup and sourceGroup ──
// Replaces getAppliedAmount + the nested sEntry/lEntry cartesian loop.
// That combination produced one row per (source, linked) PAIR with an
// undifferentiated amount, which only happened to be correct in the
// simplest 1-to-1 / many-to-1 cases. With multiple sources AND multiple
// linked transactions in the same payment (e.g. several VendorCredits
// applied across several Bills), it overcounts: it has no mechanism to
// split a single source's amount across more than one linked transaction
// or vice versa. FIFO consumes amounts in order and emits exactly the
// partial-amount rows needed to fully allocate both sides.
const fifoAllocate = (linkedGroup, sourceGroup) => {
  const rows = [];

  const linked = linkedGroup.map(e => ({ entry: e, remaining: Math.abs(e.line.Amount) }));
  const source = sourceGroup.map(e => ({ entry: e, remaining: Math.abs(e.line.Amount) }));

  let li = 0;
  let si = 0;

  while (li < linked.length && si < source.length) {
    const l = linked[li];
    const s = source[si];

    if (l.remaining <= 0) { li++; continue; }
    if (s.remaining <= 0) { si++; continue; }

    const allocAmount = Math.min(l.remaining, s.remaining);

    rows.push({
      sourceEntry: s.entry,
      linkedEntry: l.entry,
      appliedAmount: allocAmount,
    });

    l.remaining -= allocAmount;
    s.remaining -= allocAmount;

    if (l.remaining <= 0.009) li++;
    if (s.remaining <= 0.009) si++;
  }

  return rows;
};

// ── balance check ──
// Drives when the amount-matching fallback runs: not just on an empty
// group, but on any grouping (including a fully classified one) whose
// totals don't actually reconcile.
const sumAbs = (group) => group.reduce((s, x) => s + Math.abs(x.line.Amount), 0);

const isBalanced = (linkedGroup, sourceGroup, tolerance = 0.01) =>
  linkedGroup.length > 0 &&
  sourceGroup.length > 0 &&
  Math.abs(sumAbs(linkedGroup) - sumAbs(sourceGroup)) <= tolerance;

export const fetchBillAllocations = async (accessToken, realmId, startDate, endDate) => {
  const results = [];
  let skippedSingleTxn = 0;
  let skippedOnlyBill = 0;
  let skippedNoGroups = 0;
  let fallbackUsedCount = 0;

  const entityCache = {};
  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      entityCache[key] = await fetchEntityDetail(accessToken, realmId, txnId, txnType);
    }
    return entityCache[key];
  };

  // Resolved once per run, cached per realm — see getAPAccountIds.
  const apAccountIds = await getAPAccountIds(accessToken, realmId);

  // ── BillPayment fetch — MongoDB cache ya QBO ──
  let billPayments = [];
  if (!startDate && !endDate) {
    const cached = await getBillPaymentsFromCache(realmId);
    if (cached.length > 0) {
      console.log(`⚡ ${cached.length} bill payments from MongoDB cache`);
      billPayments = cached;
    } else {
      billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment', null, null);
      await saveBillPaymentsToCache(realmId, billPayments);
    }
  } else {
    billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment', startDate, endDate);
  }

  console.log(`✅ BillPayments to process: ${billPayments.length}`);

  for (const bp of billPayments) {
    const lines = bp.Line || [];

    // ── Unique txns collect karo ──
    const seenIds = new Set();
    const uniqueLines = [];
    for (const line of lines) {
      for (const txn of (line.LinkedTxn || [])) {
        if (!seenIds.has(txn.TxnId)) {
          seenIds.add(txn.TxnId);
          uniqueLines.push({ line, txn });
        }
      }
    }

    // ── Skip: empty ya single txn ──
    if (uniqueLines.length <= 1) {
      console.log(
        "SINGLE TXN",
        bp.Id,
        uniqueLines[0]?.txn?.TxnType,
        uniqueLines[0]?.txn?.TxnId
      );
      skippedSingleTxn++;
      continue;
    }

    // ── Skip: sirf Bill linked hain ──
    const hasNonBill = uniqueLines.some(({ txn }) => txn.TxnType !== 'Bill');
    if (!hasNonBill) {
      skippedOnlyBill++;
      continue;
    }

    let sourceGroup = [];
    let linkedGroup = [];
    const unclassified = [];

    // ── Unified classification (2-txn and 3+-txn payments alike) ──
    // The old `uniqueLines.length === 2` branch assigned
    // linkedGroup=[0] / sourceGroup=[1] purely by array position, with
    // no guarantee QBO returns LinkedTxn entries in a meaningful order.
    // Every payment now goes through the same fixed-type + AP-direction
    // rules regardless of how many transactions are linked.
    for (const item of uniqueLines) {
      const txnType = item.txn.TxnType;

      // Bill fixed linked
      if (txnType === "Bill") {
        linkedGroup.push(item);
        continue;
      }

      // VendorCredit fixed source
      if (txnType === "VendorCredit") {
        sourceGroup.push(item);
        continue;
      }

      if (
        txnType === "Check" ||
        txnType === "Expense" ||
        txnType === "Purchase" ||
        txnType === "Deposit" ||
        txnType === "CreditCardCredit" ||
        txnType === "JournalEntry"
      ) {
        const apInfo = await getAPDirection(accessToken, realmId, item.txn.TxnId, txnType, apAccountIds);
        console.log("AP DIRECTION", txnType, item.txn.TxnId, apInfo);

        // Uniform mapping for every type: AP Debit = Source, AP Credit = Linked.
        if (apInfo?.postingType === "Debit") {
          sourceGroup.push(item);
        } else if (apInfo?.postingType === "Credit") {
          linkedGroup.push(item);
        } else {
          // AP line not found/resolved — don't guess, let the
          // amount-matching fallback below try to resolve it.
          unclassified.push(item);
        }
        continue;
      }

      console.log("⚠ Unknown transaction type, deferring to fallback:", txnType, item.txn.TxnId);
      unclassified.push(item);
    }

    // ── Amount matching fallback ──
    // Triggers on imbalance, not just an empty group — covers the case
    // where classification produces two non-empty groups that simply
    // don't sum to the same total (e.g. Purchase 300 / VendorCredit 100 /
    // JournalEntry 200, which only balances as Linked:[300] vs
    // Source:[100,200]).
    if (unclassified.length > 0 || !isBalanced(linkedGroup, sourceGroup)) {
      const fallback = amountMatchingFallback(uniqueLines);
      if (fallback) {
        sourceGroup = fallback.sourceGroup;
        linkedGroup = fallback.linkedGroup;
        fallbackUsedCount++;
        console.log("AMOUNT MATCHING RESULT:", bp.Id, "linked=", linkedGroup.map(x => x.txn.TxnId), "source=", sourceGroup.map(x => x.txn.TxnId));
      } else {
        console.log("AMOUNT MATCHING RESULT:", bp.Id, "no match found");
      }
    }

    if (!isBalanced(linkedGroup, sourceGroup)) {
      skippedNoGroups++;
      continue;
    }

    // ── Allocation rows (FIFO) ──
    const fifoRows = fifoAllocate(linkedGroup, sourceGroup);

    for (const row of fifoRows) {
      const sEntry = row.sourceEntry;
      const lEntry = row.linkedEntry;

      const sRef = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
      const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

      const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
      const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

      results.push({
        PAYMENT_ID: bp.Id,
        REFERENCE_NO: bp.DocNumber || bp.Id,
        NAME: bp.VendorRef?.name || '',
        ALLOCATION_DATE: bp.TxnDate || '',
        CREDIT_NOTE_ID: sEntry.txn.TxnId,
        CREDIT_NOTE_NO: sRefNo,
        LINKED_REF_NO: lRefNo,
        LINKED_TXN_ID: lEntry.txn.TxnId,
        APPLIED_AMOUNT: row.appliedAmount,
        CREDIT_LINK_TYPE: sEntry.txn.TxnType,
        LINKED_TYPE: lEntry.txn.TxnType,
        TOTAL: sRef?.totalAmt || '',
      });
    }
  }

  console.log({
    totalBillPayments: billPayments.length,
    skippedSingleTxn,
    skippedOnlyBill,
    skippedNoGroups,
    fallbackUsedCount,
    finalRecords: results.length
  });
  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};