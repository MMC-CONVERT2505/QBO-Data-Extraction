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
//   if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
//   const whereClause = conditions.length > 0 ? ` WHERE ${conditions.join(' AND ')}` : '';

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
//     const nameValues = lineEx?.any || [];
//     const refEntry = nameValues.find(nv => nv?.value?.Name === 'txnReferenceNumber');
//     return refEntry?.value?.Value || null;
//   } catch { return null; }
// };

// const getOpenBalanceFromLineEx = (lineEx) => {
//   try {
//     const nameValues = lineEx?.any || [];
//     const balEntry = nameValues.find(nv => nv?.value?.Name === 'txnOpenBalance');
//     return balEntry ? parseFloat(balEntry.value.Value) : null;
//   } catch { return null; }
// };

// const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
//   // ✅ MongoDB cache check
//   const cacheKey = `${txnType}_${txnId}`;
//   const cached = await getEntityFromCache(cacheKey, realmId);
//   if (cached) return cached;

//   try {
//     const client = qboClient(accessToken, realmId);
//     let endpoint = '';
//     if (txnType === 'VendorCredit')      endpoint = `/vendorcredit/${txnId}`;
//     else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
//     else if (txnType === 'Deposit')      endpoint = `/deposit/${txnId}`;
//     else if (txnType === 'Bill')         endpoint = `/bill/${txnId}`;
//     else if (txnType === 'Purchase')     endpoint = `/purchase/${txnId}`;
//     else if (txnType === 'Check')        endpoint = `/purchase/${txnId}`;
//     else return { docNumber: txnId, txnDate: '', totalAmt: '' };

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.VendorCredit
//                 || res.data?.JournalEntry
//                 || res.data?.Deposit
//                 || res.data?.Bill
//                 || res.data?.Purchase
//                 || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const lines = entity.Line || [];
//       totalAmt = lines
//         .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
//         .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     const result = {
//       docNumber: entity.DocNumber || txnId,
//       txnDate:   entity.TxnDate   || '',
//       totalAmt:  totalAmt,
//     };

//     // ✅ Cache mein save karo
//     await saveEntityToCache(cacheKey, realmId, result);
//     return result;

//   } catch (err) {
//     console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };

// const SOURCE_PRIORITY = {
//   'VendorCredit':     10,
//   'CreditCardCredit':  9,
//   'JournalEntry':      5,
//   'Deposit':           4,
//   'Purchase':          3,
//   'Check':             3,
//   'Bill':              1,
// };
// const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

// export const fetchBillAllocations = async (accessToken, realmId, startDate, endDate) => {
//   const results = [];
//   const entityCache = {};

//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
//     }
//     return entityCache[key];
//   };

//   // ✅ Cache logic
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

//     if (uniqueLines.length === 0) continue;
//     if (uniqueLines.length === 1) continue;

//     const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);
//     const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
//     const half = totalAmt / 2;

//     let runningSum = 0;
//     const group1 = [], group2 = [];

//     for (const entry of sorted) {
//       runningSum += entry.line.Amount;
//       if (runningSum <= half + 0.01) group1.push(entry);
//       else group2.push(entry);
//     }

//     const hasVC = (group) =>
//       group.some(e => e.txn.TxnType === 'VendorCredit' || e.txn.TxnType === 'CreditCardCredit');

//     let sourceGroup, linkedGroup;
//     if (hasVC(group1))      { sourceGroup = group1; linkedGroup = group2; }
//     else if (hasVC(group2)) { sourceGroup = group2; linkedGroup = group1; }
//     else {
//       const sum1 = group1.reduce((s, e) => s + e.line.Amount, 0);
//       const sum2 = group2.reduce((s, e) => s + e.line.Amount, 0);
//       if (sum2 >= sum1) { sourceGroup = group2; linkedGroup = group1; }
//       else              { sourceGroup = group1; linkedGroup = group2; }
//     }

//     if (sourceGroup.length > 0 && linkedGroup.length > 0) {
//       for (const sEntry of sourceGroup) {
//         const sRef   = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
//         const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

//         for (const lEntry of linkedGroup) {
//           const lRef   = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//           const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//           const appliedAmount = sourceGroup.length > linkedGroup.length
//             ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
//             : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

//           results.push({
//             PAYMENT_ID:       bp.Id,
//             REFERENCE_NO:     bp.DocNumber || bp.Id,
//             NAME:             bp.VendorRef?.name || '',
//             ALLOCATION_DATE:  bp.TxnDate || '',
//             CREDIT_NOTE_ID:   sEntry.txn.TxnId,
//             CREDIT_NOTE_NO:   sRefNo,
//             LINKED_REF_NO:    lRefNo,
//             LINKED_TXN_ID:    lEntry.txn.TxnId,
//             APPLIED_AMOUNT:   appliedAmount,
//             CREDIT_LINK_TYPE: sEntry.txn.TxnType,
//             LINKED_TYPE:      lEntry.txn.TxnType,
//             TOTAL:            sRef?.totalAmt || '',
//           });
//         }
//       }
//     } else {
//       for (const { line, txn } of uniqueLines) {
//         const ref   = await getEntityDetails(txn.TxnId, txn.TxnType);
//         const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;

//         results.push({
//           PAYMENT_ID:       bp.Id,
//           REFERENCE_NO:     bp.DocNumber || bp.Id,
//           NAME:             bp.VendorRef?.name || '',
//           ALLOCATION_DATE:  bp.TxnDate || '',
//           CREDIT_NOTE_ID:   '',
//           CREDIT_NOTE_NO:   '',
//           LINKED_REF_NO:    refNo,
//           LINKED_TXN_ID:    txn.TxnId,
//           APPLIED_AMOUNT:   getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
//           CREDIT_LINK_TYPE: '',
//           LINKED_TYPE:      txn.TxnType,
//           TOTAL:            '',
//         });
//       }
//     }
//   }

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
  if (endDate)   conditions.push(`TxnDate <= '${endDate}'`);
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
      'VendorCredit':     `/vendorcredit/${txnId}`,
      'Bill':             `/bill/${txnId}`,
      'JournalEntry':     `/journalentry/${txnId}`,
      'Deposit':          `/deposit/${txnId}`,
      'Purchase':         `/purchase/${txnId}`,
      'Check':            `/purchase/${txnId}`,
      'CreditCardCredit': `/creditcardcredit/${txnId}`,
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
      txnDate:   entity.TxnDate   || '',
      totalAmt:  totalAmt,
    };

    await saveEntityToCache(cacheKey, realmId, result);
    return result;

  } catch (err) {
    console.log(`❌ ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

// ── AP Priority ──
const AP_PRIORITY = {
  'VendorCredit':     10,
  'CreditCardCredit':  9,
  'JournalEntry':      8,
  'Deposit':           7,
  'Purchase':          6,
  'Check':             5,
  'Bill':              1,
};

const getAPPriority = (txnType) => AP_PRIORITY[txnType] ?? 2;

const classifyLines = (uniqueLines) => {
  const withPriority = uniqueLines.map(entry => ({
    ...entry,
    priority: getAPPriority(entry.txn.TxnType),
  }));

  const maxPriority = Math.max(...withPriority.map(e => e.priority));

  const sourceGroup = withPriority.filter(e => e.priority === maxPriority);
  const linkedGroup = withPriority.filter(e => e.priority !== maxPriority);

  return { sourceGroup, linkedGroup };
};

const getAppliedAmount = (sEntry, lEntry, sourceGroup, linkedGroup) => {
  // ✅ Multiple sources, single linked → each source ka apna amount
  if (sourceGroup.length > 1 && linkedGroup.length === 1) {
    return sEntry.line.Amount;
  }

  // ✅ Single source, single linked
  if (sourceGroup.length === 1 && linkedGroup.length === 1) {
    return getOpenBalanceFromLineEx(sEntry.line.LineEx)
        ?? getOpenBalanceFromLineEx(lEntry.line.LineEx)
        ?? sEntry.line.Amount;
  }

  // ✅ Multiple sources, multiple linked → existing logic
  return getOpenBalanceFromLineEx(lEntry.line.LineEx)
      ?? getOpenBalanceFromLineEx(sEntry.line.LineEx)
      ?? sEntry.line.Amount;
};

export const fetchBillAllocations = async (accessToken, realmId, startDate, endDate) => {
  const results = [];

  const entityCache = {};
  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      entityCache[key] = await fetchEntityDetail(accessToken, realmId, txnId, txnType);
    }
    return entityCache[key];
  };

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
    if (uniqueLines.length <= 1) continue;

    // ── Skip: sirf Bill linked hain ──
    const hasNonBill = uniqueLines.some(({ txn }) => txn.TxnType !== 'Bill');
    if (!hasNonBill) continue;

    // ── Classify: priority se ──
    const { sourceGroup, linkedGroup } = classifyLines(uniqueLines);

    if (sourceGroup.length === 0 || linkedGroup.length === 0) continue;

    // ── Allocation rows ──
    for (const sEntry of sourceGroup) {
      const sRef   = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
      const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

      for (const lEntry of linkedGroup) {
        const lRef   = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
        const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

        const appliedAmount = getAppliedAmount(sEntry, lEntry, sourceGroup, linkedGroup);

        results.push({
          PAYMENT_ID:       bp.Id,
          REFERENCE_NO:     bp.DocNumber || bp.Id,
          NAME:             bp.VendorRef?.name || '',
          ALLOCATION_DATE:  bp.TxnDate || '',
          CREDIT_NOTE_ID:   sEntry.txn.TxnId,
          CREDIT_NOTE_NO:   sRefNo,
          LINKED_REF_NO:    lRefNo,
          LINKED_TXN_ID:    lEntry.txn.TxnId,
          APPLIED_AMOUNT:   appliedAmount,
          CREDIT_LINK_TYPE: sEntry.txn.TxnType,
          LINKED_TYPE:      lEntry.txn.TxnType,
          TOTAL:            sRef?.totalAmt || '',
        });
      }
    }
  }

  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};