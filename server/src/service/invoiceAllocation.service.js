import { qboQuery } from './qboClient.js';

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
  } catch {
    return null;
  }
};

const getOpenBalanceFromLineEx = (lineEx) => {
  try {
    const nameValues = lineEx?.any || [];
    const balEntry = nameValues.find(nv => nv?.value?.Name === 'txnOpenBalance');
    return balEntry ? parseFloat(balEntry.value.Value) : null;
  } catch {
    return null;
  }
};


export const fetchInvoiceAllocations = async (accessToken, realmId) => {
  const results = [];

  // ── Invoice map ──
  const invoices = await fetchAllRecords(accessToken, realmId, 'Invoice');
  console.log(`✅ Invoices fetched: ${invoices.length}`);
  const invoiceMap = {};
  for (const inv of invoices) {
    invoiceMap[inv.Id] = {
      docNumber: inv.DocNumber || inv.Id,
      txnDate: inv.TxnDate || '',
    };
  }

  // ── CreditMemo map ──
  const creditMemos = await fetchAllRecords(accessToken, realmId, 'CreditMemo');
  console.log(`✅ CreditMemos fetched: ${creditMemos.length}`);
  const creditMemoMap = {};
  for (const cm of creditMemos) {
    creditMemoMap[cm.Id] = {
      docNumber: cm.DocNumber || cm.Id,
      txnDate: cm.TxnDate || '',
      totalAmt: cm.TotalAmt || '',
      customerName: cm.CustomerRef?.name || '',
    };
  }

  // ── Payments ──
  const payments = await fetchAllRecords(accessToken, realmId, 'Payment');
  console.log(`✅ Payments fetched: ${payments.length}`);

  for (const payment of payments) {
    const lines = payment.Line || [];

    // Sabse pehle CreditMemo lines dhundo
    const creditMemoLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => lt.TxnType === 'CreditMemo')
    );

    // Sirf CreditMemo wali payments process karo
    if (creditMemoLines.length === 0) continue;

    // Is payment ki saari Invoice lines
    const invoiceLines = lines.filter(l =>
      (l.LinkedTxn || []).some(lt => lt.TxnType === 'Invoice')
    );

    // Har CreditMemo line ke liye
    for (const cmLine of creditMemoLines) {
      const cmTxn = (cmLine.LinkedTxn || []).find(lt => lt.TxnType === 'CreditMemo');
      if (!cmTxn) continue;

      const cmRef = creditMemoMap[cmTxn.TxnId] || {};
      const cmNo = getRefFromLineEx(cmLine.LineEx) || cmRef.docNumber || cmTxn.TxnId;

      if (invoiceLines.length > 0) {
        // Har invoice ke saath ek row
        for (const invLine of invoiceLines) {
          const invTxn = (invLine.LinkedTxn || []).find(lt => lt.TxnType === 'Invoice');
          if (!invTxn) continue;

          const invoiceRef = invoiceMap[invTxn.TxnId] || {};
          const invoiceNo = getRefFromLineEx(invLine.LineEx) || invoiceRef.docNumber || invTxn.TxnId;
          const invoiceDate = invoiceRef.txnDate || '';

          results.push({
            PAYMENT_ID: payment.Id,
            REFERENCE_NO: payment.PaymentRefNum || payment.Id,
            NAME: payment.CustomerRef?.name || cmRef.customerName || '',
            ALLOCATION_DATE: payment.TxnDate || '',
            CREDIT_NOTE_ID: cmTxn.TxnId,
            CREDIT_NOTE_NO: cmNo,
            LINKED_REF_NO: invoiceNo,
            LINKED_TXN_ID: invTxn.TxnId,
            APPLIED_AMOUNT: getOpenBalanceFromLineEx(invLine.LineEx) ?? invLine.Amount,
            CREDIT_LINK_TYPE: invTxn.TxnType,        // "Invoice"
            LINKED_TYPE: cmTxn.TxnType,         // "CreditMemo"
            TOTAL: cmRef.totalAmt || '',
          });
        }
      } else {
        // Invoice nahi — standalone CM row
        results.push({
          PAYMENT_ID: payment.Id,
          REFERENCE_NO: payment.PaymentRefNum || payment.Id,
          NAME: payment.CustomerRef?.name || cmRef.customerName || '',
          ALLOCATION_DATE: payment.TxnDate || '',
          CREDIT_NOTE_ID: cmTxn.TxnId,
          CREDIT_NOTE_NO: cmNo,
          LINKED_REF_NO: '',
          LINKED_TXN_ID: '',
          APPLIED_AMOUNT: creditLine.Amount,
          CREDIT_LINK_TYPE: '',
          LINKED_TYPE: cmTxn.TxnType,         // "CreditMemo"
          TOTAL: cmRef.totalAmt || '',
        });
      }
    }
  }

  console.log(`✅ Final invoice allocation records: ${results.length}`);
  return results;
};