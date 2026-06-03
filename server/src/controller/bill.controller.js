import {
  fetchBillAllocations,
} from "../service/billAllocation.service.js";

import {
  generateExcel,
} from "../service/excel.service.js";

const getBillAllocations =
  async (req, res) => {
    try {
      const data =
        await fetchBillAllocations(
          req.accessToken,
          req.realmId
        );
      console.log("Bills : ", data)
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

const exportBillAllocations =
  async (req, res) => {
    try {
      const billData =
        await fetchBillAllocations(
          req.accessToken,
          req.realmId
        );
      console.log(
        "EXPORT RECORDS:",
        billData.length
      );

      const buffer =
        await generateExcel(
          [],
          billData
        );

      res.setHeader(
        "Content-Type",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      );

      res.setHeader(
        "Content-Disposition",
        `attachment; filename=Bill_Allocations_${Date.now()}.xlsx`
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
  getBillAllocations,
  exportBillAllocations,
};