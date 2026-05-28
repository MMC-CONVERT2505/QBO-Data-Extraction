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

const CREDIT_TYPES = ['VendorCredit', 'JournalEntry', 'Deposit', 'CreditCardCredit', 'Transfer'];

// ── Credit entity details fetch karo by ID + Type ──
const fetchCreditDetails = async (accessToken, realmId, txnId, txnType) => {
  try {
    const { qboClient } = await import('./qboClient.js');
    const client = qboClient(accessToken, realmId);
    let endpoint = '';

    if (txnType === 'VendorCredit') endpoint = `/vendorcredit/${txnId}`;
    else if (txnType === 'JournalEntry') endpoint = `/journalentry/${txnId}`;
    else if (txnType === 'Deposit') endpoint = `/deposit/${txnId}`;
    else return {};

    const res = await client.get(`${endpoint}?minorversion=75`);

    // Har entity ka data alag field mein hota hai
    const entity = res.data?.VendorCredit
      || res.data?.JournalEntry
      || res.data?.Deposit
      || {};

    console.log(`📦 Raw entity keys:`, Object.keys(entity)); // ← Debug ke liye

    // JournalEntry mein total calculate karna padta hai Lines se
    let totalAmt = entity.TotalAmt || entity.TotalAmount || '';

    if (txnType === 'JournalEntry' && !totalAmt) {
      // JournalEntry Lines se Credit side total nikalo
      const lines = entity.Line || [];
      const creditLines = lines.filter(l => l.JournalEntryLineDetail?.PostingType === 'Credit');
      totalAmt = creditLines.reduce((sum, l) => sum + (l.Amount || 0), 0) || '';
    }

    return {
      docNumber: entity.DocNumber || txnId,
      txnDate: entity.TxnDate || '',
      totalAmt: totalAmt,
    };
  } catch (err) {
    console.log(`❌ Error fetching ${txnType} ${txnId}:`, err.message);
    return {};
  }
};

export const fetchBillAllocations = async (accessToken, realmId) => {
  const results = [];

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

  // ── BillPayments ──
  const billPayments = await fetchAllRecords(accessToken, realmId, 'BillPayment');
  console.log(`✅ BillPayments fetched: ${billPayments.length}`);

  // ── Credit details cache — extra API calls avoid karo ──
  const creditCache = {};

  for (const bp of billPayments) {
    const lines = bp.Line || [];

    const creditLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => CREDIT_TYPES.includes(lt.TxnType))
    );
    const billLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => lt.TxnType === 'Bill')
    );

    if (creditLines.length === 0) continue;

    for (const creditLine of creditLines) {
      const creditTxn = (creditLine.LinkedTxn || []).find(lt =>
        CREDIT_TYPES.includes(lt.TxnType)
      );
      if (!creditTxn) continue;

      // VendorCredit map mein check karo pehle
      let creditRef = vendorCreditMap[creditTxn.TxnId] || null;

      // Agar nahi mila (JournalEntry/Deposit) toh API se fetch karo
      if (!creditRef) {
        const cacheKey = `${creditTxn.TxnType}_${creditTxn.TxnId}`;
        if (!creditCache[cacheKey]) {
          console.log(`🔍 Fetching ${creditTxn.TxnType} ID: ${creditTxn.TxnId}`);
          creditCache[cacheKey] = await fetchCreditDetails(
            accessToken, realmId, creditTxn.TxnId, creditTxn.TxnType
          );
          console.log(`📦 Result:`, JSON.stringify(creditCache[cacheKey])); // ← Yeh add karo
        }
        creditRef = creditCache[cacheKey];
      }

      const creditNo = getRefFromLineEx(creditLine.LineEx) || creditRef?.docNumber || creditTxn.TxnId;
      const creditDate = creditRef?.txnDate || '';
      const creditTotal = creditRef?.totalAmt || '';

      if (billLines.length > 0) {
        for (const billLine of billLines) {
          const billTxn = (billLine.LinkedTxn || []).find(lt => lt.TxnType === 'Bill');
          if (!billTxn) continue;

          const billRef = billMap[billTxn.TxnId] || {};
          const billNo = getRefFromLineEx(billLine.LineEx) || billRef.docNumber || billTxn.TxnId;
          const billDate = billRef.txnDate || '';

          results.push({
            PAYMENT_ID: bp.Id,
            REFERENCE_NO: bp.DocNumber || bp.Id,
            NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
            ALLOCATION_DATE: bp.TxnDate || '',
            CREDIT_NOTE_ID: creditTxn.TxnId,
            CREDIT_NOTE_NO: creditNo,
            LINKED_REF_NO: billNo,
            LINKED_TXN_ID: billTxn.TxnId,
            APPLIED_AMOUNT: getOpenBalanceFromLineEx(billLine.LineEx) ?? billLine.Amount,
            CREDIT_LINK_TYPE: billTxn.TxnType,       // "Bill"
            LINKED_TYPE: creditTxn.TxnType,     // "VendorCredit/JournalEntry/Deposit"
            TOTAL: creditTotal,
          });
        }
      } else {
        results.push({
          PAYMENT_ID: bp.Id,
          REFERENCE_NO: bp.DocNumber || bp.Id,
          NAME: bp.VendorRef?.name || creditRef?.vendorName || '',
          ALLOCATION_DATE: bp.TxnDate || '',
          CREDIT_NOTE_ID: creditTxn.TxnId,
          CREDIT_NOTE_NO: creditNo,
          LINKED_REF_NO: '',
          LINKED_TXN_ID: '',
          APPLIED_AMOUNT: creditLine.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE: creditTxn.TxnType,     // "VendorCredit/JournalEntry/Deposit"
          TOTAL: creditTotal,
        });
      }
    }
  }

  console.log(`✅ Final bill allocation records: ${results.length}`);
  return results;
};