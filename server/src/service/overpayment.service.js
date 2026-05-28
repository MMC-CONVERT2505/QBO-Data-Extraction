import { qboQuery } from "./qboClient.js";

const fetchOverpayments = async (
  accessToken,
  realmId
) => {
  const results = [];

  // Customer Overpayments — Unapplied Payments
  const payRes = await qboQuery(
    accessToken,
    realmId,
    "SELECT * FROM Payment WHERE UnappliedAmt > '0' MAXRESULTS 1000"
  );

  const payments =
    payRes?.Payment || [];

  for (const p of payments) {
    results.push({
      EntityType: "Customer",

      EntityName:
        p.CustomerRef?.name || "",

      TransactionId:
        p.Id,

      AllocationType:
        "UnappliedPayment",

      TotalAmount:
        p.TotalAmt,

      UnappliedAmount:
        p.UnappliedAmt,

      Date:
        p.TxnDate,
    });
  }

  // Customer Credit Memos — Remaining Credit
  const cmRes = await qboQuery(
    accessToken,
    realmId,
    "SELECT * FROM CreditMemo WHERE RemainingCredit > '0' MAXRESULTS 1000"
  );

  const creditMemos =
    cmRes?.CreditMemo || [];

  for (const cm of creditMemos) {
    results.push({
      EntityType: "Customer",

      EntityName:
        cm.CustomerRef?.name || "",

      TransactionId:
        cm.Id,

      AllocationType:
        "UnusedCreditMemo",

      TotalAmount:
        cm.TotalAmt,

      UnappliedAmount:
        cm.RemainingCredit,

      Date:
        cm.TxnDate,
    });
  }

  // Vendor Credits — Remaining Credit
  const vcRes = await qboQuery(
    accessToken,
    realmId,
    "SELECT * FROM VendorCredit MAXRESULTS 1000"
  );

  const vendorCredits =
    vcRes?.VendorCredit || [];

  for (const vc of vendorCredits) {
    if (vc.RemainingCredit > 0) {
      results.push({
        EntityType: "Vendor",

        EntityName:
          vc.VendorRef?.name || "",

        TransactionId:
          vc.Id,

        AllocationType:
          "UnusedVendorCredit",

        TotalAmount:
          vc.TotalAmt,

        UnappliedAmount:
          vc.RemainingCredit,

        Date:
          vc.TxnDate,
      });
    }
  }

  return results;
};

export {
  fetchOverpayments,
};