import {
  fetchInvoiceAllocations,
} from "../service/invoiceAllocation.service.js";

import {
  generateExcel,
} from "../service/excel.service.js";

const getInvoiceAllocations =
  async (req, res) => {
    try {
      const data =
        await fetchInvoiceAllocations(
          req.accessToken,
          req.realmId
        );

        console.log("data : ",data)

        

      res.json({
        success: true,
        count: data.length,
        data,
      });
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };

const exportInvoiceAllocations =
  async (req, res) => {
    try {
      const invoiceData =
        await fetchInvoiceAllocations(
          req.accessToken,
          req.realmId
        );

      const buffer =
        await generateExcel(
          invoiceData,
          []
        );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Invoice_Allocations_${Date.now()}.xlsx`
      );

      res.send(buffer);
    } catch (err) {
      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  };

export {
  getInvoiceAllocations,
  exportInvoiceAllocations,
};