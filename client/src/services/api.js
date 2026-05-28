import axios from 'axios'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  withCredentials: true,
})

export const getAuthUrl = () => api.get('/api/auth/url')
export const checkAuth = () => api.get('/api/auth/check')
export const logout = () => api.post('/api/auth/logout')

export const getInvoiceAllocations = () => api.get('/api/allocation/invoice')
export const exportInvoiceAllocations = () =>
  api.get('/api/allocation/invoice/export', { responseType: 'blob' })

export const getBillAllocations = () => api.get('/api/allocation/bill')
export const exportBillAllocations = () =>
  api.get('/api/allocation/bill/export', { responseType: 'blob' })

export const getOverpayments = () => api.get('/api/allocation/overpayment')