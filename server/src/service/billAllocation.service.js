// import { qboQuery, qboClient } from './qboClient.js';

// const fetchAllRecords = async (accessToken, realmId, entity) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;
//   while (true) {
//     const query = `SELECT * FROM ${entity} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.[entity] || [];
//     allRecords = [...allRecords, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }
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

// // Outstanding/Linked side types (transactions being paid)
// const LINKED_TYPES = ['Bill', 'JournalEntry', 'Deposit', 'Check', 'Purchase', 'SalesReceipt', 'Charge'];

// // Credit side types
// const CREDIT_TYPES = ['VendorCredit'];

// // Entity details fetch karo by type
// const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
//   try {
//     const client = qboClient(accessToken, realmId);
//     let endpoint = '';

//     if (txnType === 'VendorCredit') endpoint = `/vendorcredit/${txnId}`;
//     else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
//     else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
//     else if (txnType === 'Bill') endpoint = `/bill/${txnId}`;
//     else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;  // ← QBO mein Check = Purchase
//     else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
//     else {
//       // Unknown type — sirf ID return karo
//       return { docNumber: txnId, txnDate: '', totalAmt: '' };
//     }

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.VendorCredit
//       || res.data?.JournalEntry
//       || res.data?.Deposit
//       || res.data?.Bill
//       || res.data?.Purchase
//       || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';

//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const lines = entity.Line || [];
//       const creditLines = lines.filter(l =>
//         l.JournalEntryLineDetail?.PostingType === 'Credit'
//       );
//       totalAmt = creditLines.reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     return {
//       docNumber: entity.DocNumber
//         || (txnType === 'Deposit' ? `DEP-${txnId}` : txnId),
//       txnDate: entity.TxnDate || '',
//       totalAmt: totalAmt,
//     };
//   } catch (err) {
//     console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };



// export const fetchBillAllocationsV2 = async (
//   accessToken,
//   realmId
// ) => {

//   const results = [];
//   const entityCache = {};
//   console.log("🚀 V2 FUNCTION CALLED");
//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;

//     if (!entityCache[key]) {
//       entityCache[key] =
//         await fetchEntityDetails(
//           accessToken,
//           realmId,
//           txnId,
//           txnType
//         );
//     }

//     console.log(
//       JSON.stringify(results[0], null, 2)
//     );

//     return entityCache[key];
//   };

//   const billPayments = await fetchAllRecords(
//     accessToken,
//     realmId,
//     'BillPayment'
//   );

//   console.log(
//     `✅ BillPayments fetched: ${billPayments.length}`
//   );

//   for (const bp of billPayments) {

//     const lines = bp.Line || [];

//     for (const line of lines) {

//       const linkedTxns =
//         line.LinkedTxn || [];

//       for (const txn of linkedTxns) {

//         const ref =
//           await getEntityDetails(
//             txn.TxnId,
//             txn.TxnType
//           );

//         results.push({

//           PAYMENT_ID:
//             bp.Id,

//           PAYMENT_NO:
//             bp.DocNumber || bp.Id,

//           PAYMENT_DATE:
//             bp.TxnDate || '',

//           VENDOR_NAME:
//             bp.VendorRef?.name || '',

//           TXN_ID:
//             txn.TxnId,

//           TXN_NO:
//             ref?.docNumber || txn.TxnId,

//           TXN_DATE:
//             ref?.txnDate || '',

//           TXN_TYPE:
//             txn.TxnType,

//           APPLIED_AMOUNT:
//             line.Amount || 0,

//         });
//       }
//     }
//   }

//   console.log(
//     `✅ Final bill allocation V2 records: ${results.length}`
//   );

//   return results;
// };

// export const fetchBillAllocations = async (accessToken, realmId) => {
//   const results = [];
//   const entityCache = {};

//   // ── Bill map ──
//   const bills = await fetchAllRecords(accessToken, realmId, 'Bill');
//   console.log(`✅ Bills fetched: ${bills.length}`);
//   const billMap = {};
//   for (const bill of bills) {
//     billMap[bill.Id] = {
//       docNumber: bill.DocNumber || bill.Id,
//       txnDate: bill.TxnDate || '',
//     };
//   }

//   // ── VendorCredit map ──
//   const vendorCredits = await fetchAllRecords(accessToken, realmId, 'VendorCredit');
//   console.log(`✅ VendorCredits fetched: ${vendorCredits.length}`);
//   const vendorCreditMap = {};
//   for (const vc of vendorCredits) {
//     vendorCreditMap[vc.Id] = {
//       docNumber: vc.DocNumber || vc.Id,
//       txnDate: vc.TxnDate || '',
//       totalAmt: vc.TotalAmt || '',
//       vendorName: vc.VendorRef?.name || '',
//     };
//   }

//   // Helper — entity details cache se lo
//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       // VendorCredit map mein check karo pehle
//       if (txnType === 'VendorCredit' && vendorCreditMap[txnId]) {
//         entityCache[key] = vendorCreditMap[txnId];
//       } else {
//         entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
//       }
//     }
//     return entityCache[key];
//   };
//   console.log("🚨 OLD FUNCTION CALLED");

//   // ── BillPayments ──
//   const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
//   console.log(`✅ BillPayments fetched: ${billPayments.length}`);



//   for (const bp of billPayments) {


//     console.log(
//       "=============================="
//     );


//     console.log(
//       JSON.stringify(bp, null, 2)
//     );

//     const lines = bp.Line || [];




//     const allTxns = [];

//     for (const line of lines) {
//       for (const txn of (line.LinkedTxn || [])) {
//         allTxns.push({
//           txn,
//           amount: line.Amount
//         });
//       }
//     }

//     if (allTxns.length < 2) continue;

//     const creditTxn = allTxns[0].txn;

//     for (let i = 1; i < allTxns.length; i++) {

//       const linkedTxn = allTxns[i].txn;

//       const creditRef =
//         await getEntityDetails(
//           creditTxn.TxnId,
//           creditTxn.TxnType
//         );

//       const linkedRef =
//         await getEntityDetails(
//           linkedTxn.TxnId,
//           linkedTxn.TxnType
//         );

//       results.push({
//         PAYMENT_ID: bp.Id,
//         REFERENCE_NO: bp.DocNumber || bp.Id,
//         NAME: bp.VendorRef?.name || '',
//         ALLOCATION_DATE: bp.TxnDate || '',

//         CREDIT_NOTE_ID: linkedTxn.TxnId,
//         CREDIT_NOTE_NO:
//            linkedRef?.docNumber ||
//           linkedTxn.TxnId,

//         LINKED_REF_NO:
//           creditRef?.docNumber ||
//           creditTxn.TxnId,

//         LINKED_TXN_ID:
//           creditTxn.TxnId,

//         APPLIED_AMOUNT:
//           allTxns[i].amount,

//         CREDIT_LINK_TYPE:
//           linkedTxn.TxnType,

//         LINKED_TYPE:
//            creditTxn.TxnType,

//         TOTAL:
//           creditRef?.totalAmt || ''
//       });
//     }

//     lines.forEach(line => {
//       (line.LinkedTxn || []).forEach(txn => {
//         console.log(
//           `BP ${bp.Id} → TxnType: ${txn.TxnType}, TxnId: ${txn.TxnId}`
//         );
//       });
//     });


//   }
//   console.log(`✅ Final bill allocation records: ${results.length}`);
//   return results;
// };




// import { qboQuery, qboClient } from './qboClient.js';

// const fetchAllRecords = async (accessToken, realmId, entity) => {
//   let allRecords = [];
//   let startPosition = 1;
//   const pageSize = 1000;
//   while (true) {
//     const query = `SELECT * FROM ${entity} MAXRESULTS ${pageSize} STARTPOSITION ${startPosition}`;
//     const res = await qboQuery(accessToken, realmId, query);
//     const records = res?.[entity] || [];
//     allRecords = [...allRecords, ...records];
//     if (records.length < pageSize) break;
//     startPosition += pageSize;
//   }
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
//   try {
//     const client = qboClient(accessToken, realmId);
//     let endpoint = '';
//     if (txnType === 'VendorCredit') endpoint = `/vendorcredit/${txnId}`;
//     else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
//     else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
//     else if (txnType === 'Bill') endpoint = `/bill/${txnId}`;
//     else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
//     else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;
//     else return { docNumber: txnId, txnDate: '', totalAmt: '' };

//     const res = await client.get(`${endpoint}?minorversion=75`);
//     const entity = res.data?.VendorCredit
//       || res.data?.JournalEntry
//       || res.data?.Deposit
//       || res.data?.Bill
//       || res.data?.Purchase
//       || {};

//     let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
//     if (txnType === 'JournalEntry' && !totalAmt) {
//       const lines = entity.Line || [];
//       totalAmt = lines
//         .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
//         .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
//     }

//     return {
//       docNumber: entity.DocNumber || txnId,
//       txnDate: entity.TxnDate || '',
//       totalAmt: totalAmt,
//     };
//   } catch (err) {
//     console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
//     return { docNumber: txnId, txnDate: '', totalAmt: '' };
//   }
// };

// // ── Priority: kaun SOURCE hai ──
// // Higher number = more likely to be SOURCE (credit side)
// const SOURCE_PRIORITY = {
//   'VendorCredit': 10,
//   'CreditCardCredit': 9,
//   'JournalEntry': 5,
//   'Deposit': 4,
//   'Purchase': 3,
//   'Check': 3,
//   'Bill': 1,  // Bill hamesha linked (receiving) side hota hai
// };

// const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

// export const fetchBillAllocations = async (accessToken, realmId) => {
//   const results = [];
//   const entityCache = {};

//   const getEntityDetails = async (txnId, txnType) => {
//     const key = `${txnType}_${txnId}`;
//     if (!entityCache[key]) {
//       entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
//     }
//     return entityCache[key];
//   };

//   const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
//   console.log(`✅ BillPayments fetched: ${billPayments.length}`);

//   for (const bp of billPayments) {
//     const lines = bp.Line || [];

//     // Unique lines collect karo
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

//     // Single txn — standalone
//     if (uniqueLines.length === 1) {
//       const { line, txn } = uniqueLines[0];
//       const ref = await getEntityDetails(txn.TxnId, txn.TxnType);
//       const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;
//       results.push({
//         PAYMENT_ID: bp.Id,
//         REFERENCE_NO: bp.DocNumber || bp.Id,
//         NAME: bp.VendorRef?.name || '',
//         ALLOCATION_DATE: bp.TxnDate || '',
//         CREDIT_NOTE_ID: '',
//         CREDIT_NOTE_NO: '',
//         LINKED_REF_NO: refNo,
//         LINKED_TXN_ID: txn.TxnId,
//         APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
//         CREDIT_LINK_TYPE: '',
//         LINKED_TYPE: txn.TxnType,
//         TOTAL: '',
//       });
//       continue;
//     }

//     // Multiple txns — Amount se 2 groups banao
//     // Group A: smaller amounts (individual transactions)
//     // Group B: larger or equal amounts (totals)
//     // Sort by amount ascending
//     const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);

//     const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
//     const half = totalAmt / 2;

//     // Group 1: running sum <= half
//     // Group 2: running sum > half
//     let runningSum = 0;
//     const group1 = []; // smaller side
//     const group2 = []; // larger side

//     for (const entry of sorted) {
//       runningSum += entry.line.Amount;
//       if (runningSum <= half + 0.01) {
//         group1.push(entry);
//       } else {
//         group2.push(entry);
//       }
//     }

//     // Determine source vs linked
//     // Group with VendorCredit = source
//     const hasVC = (group) =>
//       group.some(e => e.txn.TxnType === 'VendorCredit' || e.txn.TxnType === 'CreditCardCredit');

//     let sourceGroup, linkedGroup;
//     if (hasVC(group1)) {
//       sourceGroup = group1;
//       linkedGroup = group2;
//     } else if (hasVC(group2)) {
//       sourceGroup = group2;
//       linkedGroup = group1;
//     } else {
//       // No VendorCredit — larger amount group = source
//       const sum1 = group1.reduce((s, e) => s + e.line.Amount, 0);
//       const sum2 = group2.reduce((s, e) => s + e.line.Amount, 0);
//       if (sum2 >= sum1) {
//         sourceGroup = group2;
//         linkedGroup = group1;
//       } else {
//         sourceGroup = group1;
//         linkedGroup = group2;
//       }
//     }

//     // Source × Linked cross product
//     // Source × Linked cross product
//     if (sourceGroup.length > 0 && linkedGroup.length > 0) {
//       for (const sEntry of sourceGroup) {
//         const sRef = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
//         const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

//         for (const lEntry of linkedGroup) {
//           const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//           const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//           // ✅ Smart amount logic:
//           // Multiple sources → 1 linked:  source ka amount (har credit alag)
//           // 1 source → Multiple linked:   linked ka amount (har bill alag)
//           // Multiple × Multiple:          linked ka amount
//           const appliedAmount = sourceGroup.length > linkedGroup.length
//             ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
//             : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

//           results.push({
//             PAYMENT_ID: bp.Id,
//             REFERENCE_NO: bp.DocNumber || bp.Id,
//             NAME: bp.VendorRef?.name || '',
//             ALLOCATION_DATE: bp.TxnDate || '',
//             CREDIT_NOTE_ID: sEntry.txn.TxnId,
//             CREDIT_NOTE_NO: sRefNo,
//             LINKED_REF_NO: lRefNo,
//             LINKED_TXN_ID: lEntry.txn.TxnId,
//             APPLIED_AMOUNT: appliedAmount,    // ← Smart logic
//             CREDIT_LINK_TYPE: sEntry.txn.TxnType,
//             LINKED_TYPE: lEntry.txn.TxnType,
//             TOTAL: sRef?.totalAmt || '',
//           });
//         }
//       }

//     } else {
//       // Same amount — har txn alag row
//       for (const { line, txn } of uniqueLines) {
//         const ref = await getEntityDetails(txn.TxnId, txn.TxnType);
//         const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;
//         results.push({
//           PAYMENT_ID: bp.Id,
//           REFERENCE_NO: bp.DocNumber || bp.Id,
//           NAME: bp.VendorRef?.name || '',
//           ALLOCATION_DATE: bp.TxnDate || '',
//           CREDIT_NOTE_ID: '',
//           CREDIT_NOTE_NO: '',
//           LINKED_REF_NO: refNo,
//           LINKED_TXN_ID: txn.TxnId,
//           APPLIED_AMOUNT: getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount,
//           CREDIT_LINK_TYPE: '',
//           LINKED_TYPE: txn.TxnType,
//           TOTAL: ref?.totalAmt || '',
//         });
//       }
//     }
//   }



//   console.log(`✅ Final bill allocation records: ${results.length}`);
//   return results;
// };



import { qboQuery, qboClient } from './qboClient.js';

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

const getRefFromLineEx = (lineEx) => {
  try {
    const nameValues = lineEx?.any || [];
    const refEntry = nameValues.find(nv => nv?.value?.Name === 'txnReferenceNumber');
    return refEntry?.value?.Value || null;
  } catch { return null; }
};

const getOpenBalanceFromLineEx = (lineEx) => {
  try {
    const nameValues = lineEx?.any || [];
    const balEntry = nameValues.find(nv => nv?.value?.Name === 'txnOpenBalance');
    return balEntry ? parseFloat(balEntry.value.Value) : null;
  } catch { return null; }
};

const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';
    if (txnType === 'VendorCredit')      endpoint = `/vendorcredit/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit')      endpoint = `/deposit/${txnId}`;
    else if (txnType === 'Bill')         endpoint = `/bill/${txnId}`;
    else if (txnType === 'Purchase')     endpoint = `/purchase/${txnId}`;
    else if (txnType === 'Check')        endpoint = `/purchase/${txnId}`;
    else return { docNumber: txnId, txnDate: '', totalAmt: '' };

    const res = await client.get(`${endpoint}?minorversion=75`);
    const entity = res.data?.VendorCredit
      || res.data?.JournalEntry
      || res.data?.Deposit
      || res.data?.Bill
      || res.data?.Purchase
      || {};

    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';
    if (txnType === 'JournalEntry' && !totalAmt) {
      const lines = entity.Line || [];
      totalAmt = lines
        .filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit')
        .reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    return {
      docNumber: entity.DocNumber || txnId,
      txnDate:   entity.TxnDate   || '',
      totalAmt:  totalAmt,
    };
  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};

const SOURCE_PRIORITY = {
  'VendorCredit':     10,
  'CreditCardCredit':  9,
  'JournalEntry':      5,
  'Deposit':           4,
  'Purchase':          3,
  'Check':             3,
  'Bill':              1,
};

const getPriority = (txnType) => SOURCE_PRIORITY[txnType] ?? 2;

export const fetchBillAllocations = async (accessToken, realmId) => {
  const results = [];
  const entityCache = {};

  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
    }
    return entityCache[key];
  };

  const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
  console.log(`✅ BillPayments fetched: ${billPayments.length}`);

  for (const bp of billPayments) {
    const lines = bp.Line || [];

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

    if (uniqueLines.length === 0) continue;

    // ✅ Sirf yeh line add ki — single txn skip
    if (uniqueLines.length === 1) continue;

    const sorted = [...uniqueLines].sort((a, b) => a.line.Amount - b.line.Amount);
    const totalAmt = sorted.reduce((sum, e) => sum + e.line.Amount, 0);
    const half = totalAmt / 2;

    let runningSum = 0;
    const group1 = [];
    const group2 = [];

    for (const entry of sorted) {
      runningSum += entry.line.Amount;
      if (runningSum <= half + 0.01) {
        group1.push(entry);
      } else {
        group2.push(entry);
      }
    }

    const hasVC = (group) =>
      group.some(e => e.txn.TxnType === 'VendorCredit' || e.txn.TxnType === 'CreditCardCredit');

    let sourceGroup, linkedGroup;
    if (hasVC(group1)) {
      sourceGroup = group1;
      linkedGroup = group2;
    } else if (hasVC(group2)) {
      sourceGroup = group2;
      linkedGroup = group1;
    } else {
      const sum1 = group1.reduce((s, e) => s + e.line.Amount, 0);
      const sum2 = group2.reduce((s, e) => s + e.line.Amount, 0);
      if (sum2 >= sum1) {
        sourceGroup = group2;
        linkedGroup = group1;
      } else {
        sourceGroup = group1;
        linkedGroup = group2;
      }
    }

    if (sourceGroup.length > 0 && linkedGroup.length > 0) {
      for (const sEntry of sourceGroup) {
        const sRef   = await getEntityDetails(sEntry.txn.TxnId, sEntry.txn.TxnType);
        const sRefNo = getRefFromLineEx(sEntry.line.LineEx) || sRef?.docNumber || sEntry.txn.TxnId;

        for (const lEntry of linkedGroup) {
          const lRef   = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
          const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

          const appliedAmount = sourceGroup.length > linkedGroup.length
            ? (getOpenBalanceFromLineEx(sEntry.line.LineEx) ?? sEntry.line.Amount)
            : (getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount);

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
    } else {
      for (const { line, txn } of uniqueLines) {
        const ref   = await getEntityDetails(txn.TxnId, txn.TxnType);
        const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;
        results.push({
          PAYMENT_ID:       bp.Id,
          REFERENCE_NO:     bp.DocNumber || bp.Id,
          NAME:             bp.VendorRef?.name || '',
          ALLOCATION_DATE:  bp.TxnDate || '',
          CREDIT_NOTE_ID:   '',
          CREDIT_NOTE_NO:   '',
          LINKED_REF_NO:    refNo,
          LINKED_TXN_ID:    txn.TxnId,
          APPLIED_AMOUNT:   getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE:      txn.TxnType,
          TOTAL:            '',
        });
      }
    }
  }

  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};