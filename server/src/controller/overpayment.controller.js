import {
  fetchOverpayments,
} from "../service/overpayment.service.js";

const getOverpayments =
  async (req, res) => {
    try {
      const data =
        await fetchOverpayments(
          req.accessToken,
          req.realmId
        );

        console.log("data", data)
        

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

export {
  getOverpayments,
};