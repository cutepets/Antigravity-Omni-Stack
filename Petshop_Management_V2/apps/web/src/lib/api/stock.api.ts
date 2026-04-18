import { api } from '@/lib/api'

export const stockApi = {
  getProducts: (params?: any) => api.get('/stock/products', { params }).then(res => res.data),

  // Receipts
  getReceipts: (params?: any) => api.get('/stock/receipts', { params }),
  getReceipt: (id: string) => api.get(`/stock/receipts/${id}`),
  createReceipt: (data: any) => api.post('/stock/receipts', data),
  updateReceipt: (id: string, data: any) => api.put(`/stock/receipts/${id}`, data),
  payReceipt: (id: string, data?: any) => api.patch(`/stock/receipts/${id}/pay`, data),
  createReceiptPayment: (id: string, data: any) => api.post(`/stock/receipts/${id}/payments`, data),
  createSupplierPayment: (supplierId: string, data: any) => api.post(`/stock/suppliers/${supplierId}/payments`, data),
  cancelReceipt: (id: string) => api.patch(`/stock/receipts/${id}/cancel`),
  receiveReceipt: (id: string, data?: any) => api.patch(`/stock/receipts/${id}/receive`, data),
  createReceiptReceiving: (id: string, data: any) => api.post(`/stock/receipts/${id}/receivings`, data),
  closeReceipt: (id: string, data: any) => api.post(`/stock/receipts/${id}/close`, data),
  returnReceipt: (id: string, data: any) => api.post(`/stock/receipts/${id}/returns`, data),
  refundSupplierReturn: (id: string, data: any) => api.post(`/stock/returns/${id}/refunds`, data),

  getTransactions: (productId: string, params?: { variantId?: string; variantScope?: 'base'; branchId?: string }) =>
    api.get(`/stock/transactions/${productId}`, { params }).then(res => res.data),
  getSuggestions: () => api.get('/stock/suggestions'),

  // Suppliers
  getSuppliers: () => api.get('/stock/suppliers'),
  getSupplier: (id: string) => api.get(`/stock/suppliers/${id}`),
  createSupplier: (data: any) => api.post('/stock/suppliers', data),
  updateSupplier: (id: string, data: any) => api.put(`/stock/suppliers/${id}`, data),
}
