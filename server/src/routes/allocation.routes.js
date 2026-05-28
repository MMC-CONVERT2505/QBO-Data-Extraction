import express from "express";

import authMiddleware from "../middleware/auth.middleware.js";

import {
  getInvoiceAllocations,
  exportInvoiceAllocations,
} from "../controller/invoice.controller.js";

import {
  getBillAllocations,
  exportBillAllocations,
} from "../controller/bill.controller.js";

import {
  getOverpayments,
} from "../controller/overpayment.controller.js";

const router =
  express.Router();

router.use(
  authMiddleware
);

router.get(
  "/invoice",
  getInvoiceAllocations
);

router.get(
  "/invoice/export",
  exportInvoiceAllocations
);

router.get(
  "/bill",
  getBillAllocations
);

router.get(
  "/bill/export",
  exportBillAllocations
);

router.get(
  "/overpayment",
  getOverpayments
);

export default router;