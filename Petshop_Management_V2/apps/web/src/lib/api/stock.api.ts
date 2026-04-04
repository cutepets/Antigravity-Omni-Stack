import { api } from '@/lib/api'

export const stockApi = {
  // Receipts
  getReceipts: (params?: any) => api.get('/stock/receipts', { params }),
  getReceipt: (id: string) => api.get(`/stock/receipts/${id}`),
  createReceipt: (data: any) => api.post('/stock/receipts', data),
  updateReceipt: (id: string, data: any) => api.put(`/stock/receipts/${id}`, data),
  payReceipt: (id: string) => api.patch(`/stock/receipts/${id}/pay`),
  cancelReceipt: (id: string) => api.patch(`/stock/receipts/${id}/cancel`),
  receiveReceipt: (id: string) => api.patch(`/stock/receipts/${id}/receive`),
  returnReceipt: (id: string, items: any[]) => api.post(`/stock/receipts/${id}/returns`, { items }),

  getTransactions: (productId: string) => api.get(`/stock/transactions/${productId}`),
  getSuggestions: () => api.get('/stock/suggestions'),

  // Suppliers
  getSuppliers: () => api.get('/stock/suppliers'),
  getSupplier: (id: string) => api.get(`/stock/suppliers/${id}`),
  createSupplier: (data: any) => api.post('/stock/suppliers', data),
  updateSupplier: (id: string, data: any) => api.put(`/stock/suppliers/${id}`, data),
}
