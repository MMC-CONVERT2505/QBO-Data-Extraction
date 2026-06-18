import { fetchAPOverpayments, fetchAROverpayments } from '../service/overpayment.service.js';
import { generateOverpaymentExcel } from '../service/excel.service.js';

export const getAPOverpayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await fetchAPOverpayments(req.accessToken, req.realmId, startDate, endDate);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const exportAPOverpayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await fetchAPOverpayments(req.accessToken, req.realmId, startDate, endDate);
    const buffer = await generateOverpaymentExcel(data, 'AP');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AP_Overpayments_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const getAROverpayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await fetchAROverpayments(req.accessToken, req.realmId, startDate, endDate);
    res.json({ success: true, count: data.length, data });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};

export const exportAROverpayments = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const data = await fetchAROverpayments(req.accessToken, req.realmId, startDate, endDate);
    const buffer = await generateOverpaymentExcel(data, 'AR');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=AR_Overpayments_${Date.now()}.xlsx`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
};