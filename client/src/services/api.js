
import axios from 'axios'

const api = axios.create({
  baseURL: '',
})

// ✅ Har request mein sessionId ko x-qbo-session header se attach karo
api.interceptors.request.use((config) => {
  const sessionId = localStorage.getItem('qbo_session_id')
  if (sessionId) {
    config.headers['x-qbo-session'] = sessionId
  }
  return config
})

// ✅ 401 aaye toh session clear karo (expired/invalid session)
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('qbo_session_id')
    }
    return Promise.reject(error)
  }
)

export const getAuthUrl = () => api.get('/api/auth/url')
export const checkAuth = () => api.get('/api/auth/check')
export const logout = () => api.post('/api/auth/logout')

// ── Date params ke saath ──
export const getInvoiceAllocations = (startDate, endDate) =>
  api.get('/api/allocation/invoice', { params: { startDate, endDate } })
export const exportInvoiceAllocations = (startDate, endDate) =>
  api.get('/api/allocation/invoice/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getBillAllocations = (startDate, endDate) =>
  api.get('/api/allocation/bill', { params: { startDate, endDate } })
export const exportBillAllocations = (startDate, endDate) =>
  api.get('/api/allocation/bill/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getAPOverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ap', { params: { startDate, endDate } })
export const exportAPOverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ap/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getAROverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ar', { params: { startDate, endDate } })
export const exportAROverpayments = (startDate, endDate) =>
  api.get('/api/allocation/overpayment/ar/export', { params: { startDate, endDate }, responseType: 'blob' })

export const getOverpayments = () => api.get('/api/allocation/overpayment')

// ── SSE: AP Overpayments with real-time progress ──
export const getAPOverpaymentsSSE = (startDate, endDate, onProgress, onDone, onError) => {
  const sessionId = localStorage.getItem('qbo_session_id');
  const params = new URLSearchParams();
  if (startDate) params.append('startDate', startDate);
  if (endDate)   params.append('endDate', endDate);
  if (sessionId) params.append('sessionId', sessionId);

  const url = `/api/allocation/overpayment/ap/progress?${params.toString()}`;
  const es = new EventSource(url);

  es.onmessage = (e) => {
    const data = JSON.parse(e.data);
    if (data.type === 'progress' || data.type === 'total' || data.type === 'status') {
      onProgress(data);
    } else if (data.type === 'done') {
      es.close();
      onDone(data.data);
    } else if (data.type === 'error') {
      es.close();
      onError(data.message);
    }
  };

  es.onerror = () => {
    es.close();
    onError('Connection lost');
  };

  return es; // caller chahiye toh close kar sake
};