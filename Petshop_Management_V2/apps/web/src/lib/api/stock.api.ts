import axios from 'axios'

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
})

// Add auth interceptor if needed (assuming relying on standard auth in app)
api.interceptors.request.use((config) => {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

export const stockApi = {
  // Receipts
  getReceipts: (params?: any) => api.get('/stock/receipts', { params }).then(res => res.data),
  getReceipt: (id: string) => api.get(`/stock/receipts/${id}`).then(res => res.data),
  createReceipt: (data: any) => api.post('/stock/receipts', data).then(res => res.data),
  updateReceipt: (id: string, data: any) => api.put(`/stock/receipts/${id}`, data).then(res => res.data),
  payReceipt: (id: string) => api.patch(`/stock/receipts/${id}/pay`).then(res => res.data),
  cancelReceipt: (id: string) => api.patch(`/stock/receipts/${id}/cancel`).then(res => res.data),
  receiveReceipt: (id: string) => api.patch(`/stock/receipts/${id}/receive`).then(res => res.data),
  
  getTransactions: (productId: string) => api.get(`/stock/transactions/${productId}`).then(res => res.data),
  getSuggestions: () => api.get('/stock/suggestions').then(res => res.data),

  // Suppliers
  getSuppliers: () => api.get('/stock/suppliers').then(res => res.data),
  getSupplier: (id: string) => api.get(`/stock/suppliers/${id}`).then(res => res.data),
  createSupplier: (data: any) => api.post('/stock/suppliers', data).then(res => res.data),
  updateSupplier: (id: string, data: any) => api.put(`/stock/suppliers/${id}`, data).then(res => res.data),
}
