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

// Outstanding/Linked side types (transactions being paid)
const LINKED_TYPES = ['Bill', 'JournalEntry', 'Deposit', 'Check', 'Purchase', 'SalesReceipt', 'Charge'];

// Credit side types
const CREDIT_TYPES = ['VendorCredit'];

// Entity details fetch karo by type
const fetchEntityDetails = async (accessToken, realmId, txnId, txnType) => {
  try {
    const client = qboClient(accessToken, realmId);
    let endpoint = '';

    if (txnType === 'VendorCredit') endpoint = `/vendorcredit/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
    else if (txnType === 'Bill') endpoint = `/bill/${txnId}`;
    else if (txnType === 'Check') endpoint = `/purchase/${txnId}`;  // ← QBO mein Check = Purchase
    else if (txnType === 'Purchase') endpoint = `/purchase/${txnId}`;
    else {
      // Unknown type — sirf ID return karo
      return { docNumber: txnId, txnDate: '', totalAmt: '' };
    }

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
      const creditLines = lines.filter(l =>
        l.JournalEntryLineDetail?.PostingType === 'Credit'
      );
      totalAmt = creditLines.reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    return {
      docNumber: entity.DocNumber
        || (txnType === 'Deposit' ? `DEP-${txnId}` : txnId),
      txnDate: entity.TxnDate || '',
      totalAmt: totalAmt,
    };
  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return { docNumber: txnId, txnDate: '', totalAmt: '' };
  }
};



export const fetchBillAllocationsV2 = async (
  accessToken,
  realmId
) => {

  const results = [];
  const entityCache = {};
  console.log("🚀 V2 FUNCTION CALLED");
  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;

    if (!entityCache[key]) {
      entityCache[key] =
        await fetchEntityDetails(
          accessToken,
          realmId,
          txnId,
          txnType
        );
    }

    console.log(
      JSON.stringify(results[0], null, 2)
    );

    return entityCache[key];
  };

  const billPayments = await fetchAllRecords(
    accessToken,
    realmId,
    'BillPayment'
  );

  console.log(
    `✅ BillPayments fetched: ${billPayments.length}`
  );

  for (const bp of billPayments) {

    const lines = bp.Line || [];

    for (const line of lines) {

      const linkedTxns =
        line.LinkedTxn || [];

      for (const txn of linkedTxns) {

        const ref =
          await getEntityDetails(
            txn.TxnId,
            txn.TxnType
          );

        results.push({

          PAYMENT_ID:
            bp.Id,

          PAYMENT_NO:
            bp.DocNumber || bp.Id,

          PAYMENT_DATE:
            bp.TxnDate || '',

          VENDOR_NAME:
            bp.VendorRef?.name || '',

          TXN_ID:
            txn.TxnId,

          TXN_NO:
            ref?.docNumber || txn.TxnId,

          TXN_DATE:
            ref?.txnDate || '',

          TXN_TYPE:
            txn.TxnType,

          APPLIED_AMOUNT:
            line.Amount || 0,

        });
      }
    }
  }

  console.log(
    `✅ Final bill allocation V2 records: ${results.length}`
  );

  return results;
};

export const fetchBillAllocations = async (accessToken, realmId) => {
  const results = [];
  const entityCache = {};

  // ── Bill map ──
  const bills = await fetchAllRecords(accessToken, realmId, 'Bill');
  console.log(`✅ Bills fetched: ${bills.length}`);
  const billMap = {};
  for (const bill of bills) {
    billMap[bill.Id] = {
      docNumber: bill.DocNumber || bill.Id,
      txnDate: bill.TxnDate || '',
    };
  }

  // ── VendorCredit map ──
  const vendorCredits = await fetchAllRecords(accessToken, realmId, 'VendorCredit');
  console.log(`✅ VendorCredits fetched: ${vendorCredits.length}`);
  const vendorCreditMap = {};
  for (const vc of vendorCredits) {
    vendorCreditMap[vc.Id] = {
      docNumber: vc.DocNumber || vc.Id,
      txnDate: vc.TxnDate || '',
      totalAmt: vc.TotalAmt || '',
      vendorName: vc.VendorRef?.name || '',
    };
  }

  // Helper — entity details cache se lo
  const getEntityDetails = async (txnId, txnType) => {
    const key = `${txnType}_${txnId}`;
    if (!entityCache[key]) {
      // VendorCredit map mein check karo pehle
      if (txnType === 'VendorCredit' && vendorCreditMap[txnId]) {
        entityCache[key] = vendorCreditMap[txnId];
      } else {
        entityCache[key] = await fetchEntityDetails(accessToken, realmId, txnId, txnType);
      }
    }
    return entityCache[key];
  };
  console.log("🚨 OLD FUNCTION CALLED");

  // ── BillPayments ──
  const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
  console.log(`✅ BillPayments fetched: ${billPayments.length}`);



  for (const bp of billPayments) {


    console.log(
      "=============================="
    );


    console.log(
      JSON.stringify(bp, null, 2)
    );

    const lines = bp.Line || [];


    const allTxns = [];

    for (const line of lines) {
      for (const txn of (line.LinkedTxn || [])) {
        allTxns.push({
          txn,
          amount: line.Amount
        });
      }
    }

    if (allTxns.length < 2) continue;

    const creditTxn = allTxns[0].txn;

    for (let i = 1; i < allTxns.length; i++) {

      const linkedTxn = allTxns[i].txn;

      const creditRef =
        await getEntityDetails(
          creditTxn.TxnId,
          creditTxn.TxnType
        );

      const linkedRef =
        await getEntityDetails(
          linkedTxn.TxnId,
          linkedTxn.TxnType
        );

      results.push({
        PAYMENT_ID: bp.Id,
        REFERENCE_NO: bp.DocNumber || bp.Id,
        NAME: bp.VendorRef?.name || '',
        ALLOCATION_DATE: bp.TxnDate || '',

        CREDIT_NOTE_ID: linkedTxn.TxnId,
        CREDIT_NOTE_NO:
           linkedRef?.docNumber ||
          linkedTxn.TxnId,

        LINKED_REF_NO:
          creditRef?.docNumber ||
          creditTxn.TxnId,

        LINKED_TXN_ID:
          creditTxn.TxnId,

        APPLIED_AMOUNT:
          allTxns[i].amount,

        CREDIT_LINK_TYPE:
          linkedTxn.TxnType,

        LINKED_TYPE:
           creditTxn.TxnType,

        TOTAL:
          creditRef?.totalAmt || ''
      });
    }

    lines.forEach(line => {
      (line.LinkedTxn || []).forEach(txn => {
        console.log(
          `BP ${bp.Id} → TxnType: ${txn.TxnType}, TxnId: ${txn.TxnId}`
        );
      });
    });


  }
  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};





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

// // Credit side types — jo payment karte hain
// const CREDIT_TYPES = ['VendorCredit', 'CreditCardCredit'];

// // Linked/Outstanding side types — jo pay kiye ja rahe hain
// const LINKED_TYPES = ['Bill', 'JournalEntry', 'Deposit', 'Purchase', 'SalesReceipt', 'Charge', 'Check'];

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
//     else if (txnType === 'CreditCardCredit') endpoint = `/purchase/${txnId}`;
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
//       const creditLines = lines.filter(l =>
//         l.JournalEntryLineDetail?.PostingType === 'Credit'
//       );
//       totalAmt = creditLines.reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
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

//     // Saari txns collect karo
//     const allTxns = [];
//     for (const line of lines) {
//       for (const txn of (line.LinkedTxn || [])) {
//         allTxns.push({ line, txn });
//       }
//     }

//     if (allTxns.length === 0) continue;

//     // Agar sirf 1 txn hai
//     if (allTxns.length === 1) {
//       const { line, txn } = allTxns[0];
//       const ref = await getEntityDetails(txn.TxnId, txn.TxnType);
//       const refNo = getRefFromLineEx(line.LineEx) || ref?.docNumber || txn.TxnId;

//       results.push({
//         PAYMENT_ID: bp.Id,
//         REFERENCE_NO: bp.DocNumber || bp.Id,
//         NAME: bp.VendorRef?.name || '',
//         ALLOCATION_DATE: bp.TxnDate || '',
//         CREDIT_NOTE_ID: txn.TxnId,
//         CREDIT_NOTE_NO: refNo,
//         LINKED_REF_NO: '',
//         LINKED_TXN_ID: '',
//         APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
//         CREDIT_LINK_TYPE: txn.TxnType,
//         LINKED_TYPE: '',
//         TOTAL: ref?.totalAmt || '',
//       });
//       continue;
//     }

//     // ── 2+ txns: Credit × Linked pairs ──
//     // Credit types
//     const creditEntries = allTxns.filter(e =>
//       ['VendorCredit', 'CreditCardCredit'].includes(e.txn.TxnType)
//     );

//     // Linked types (sab jo credit nahi)
//     const linkedEntries = allTxns.filter(e =>
//       !['VendorCredit', 'CreditCardCredit'].includes(e.txn.TxnType)
//     );

//     if (creditEntries.length > 0 && linkedEntries.length > 0) {
//       // Credit × Linked cross product
//       for (const cEntry of creditEntries) {
//         const cRef = await getEntityDetails(cEntry.txn.TxnId, cEntry.txn.TxnType);
//         const cRefNo = getRefFromLineEx(cEntry.line.LineEx) || cRef?.docNumber || cEntry.txn.TxnId;

//         for (const lEntry of linkedEntries) {
//           const lRef = await getEntityDetails(lEntry.txn.TxnId, lEntry.txn.TxnType);
//           const lRefNo = getRefFromLineEx(lEntry.line.LineEx) || lRef?.docNumber || lEntry.txn.TxnId;

//           results.push({
//             PAYMENT_ID: bp.Id,
//             REFERENCE_NO: bp.DocNumber || bp.Id,
//             NAME: bp.VendorRef?.name || '',
//             ALLOCATION_DATE: bp.TxnDate || '',
//             CREDIT_NOTE_ID: cEntry.txn.TxnId,
//             CREDIT_NOTE_NO: cRefNo,
//             LINKED_REF_NO: lRefNo,
//             LINKED_TXN_ID: lEntry.txn.TxnId,
//             APPLIED_AMOUNT: getOpenBalanceFromLineEx(lEntry.line.LineEx) ?? lEntry.line.Amount,
//             CREDIT_LINK_TYPE: cEntry.txn.TxnType,   // VendorCredit
//             LINKED_TYPE: lEntry.txn.TxnType,   // Bill/Purchase/JournalEntry/Deposit
//             TOTAL: cRef?.totalAmt || '',
//           });
//         }
//       }
//     } else {
//       // Sirf linked — no credit (Purchase × Purchase, Purchase × Deposit etc.)
//       for (const { line, txn } of allTxns) {
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
//           APPLIED_AMOUNT: getOpenBalanceFromLineEx(line.LineEx) ?? line.Amount,
//           CREDIT_LINK_TYPE: '',
//           LINKED_TYPE: txn.TxnType,   // Purchase/Deposit/JournalEntry
//           TOTAL: ref?.totalAmt || '',
//         });
//       }
//     }
//   }

//   console.log(`✅ Final bill allocation records: ${results.length}`);
//   return results;
// };