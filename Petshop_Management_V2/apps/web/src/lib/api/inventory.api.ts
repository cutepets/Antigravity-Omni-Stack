import { api } from '@/lib/api'

export const inventoryApi = {
  getProducts: (params?: any, config?: any) => api.get('/inventory/products', { params, ...config }).then(res => res.data),
  getProduct: (id: string) => api.get(`/inventory/products/${id}`).then(res => res.data),
  createProduct: (data: any) => api.post('/inventory/products', data).then(res => res.data),
  updateProduct: (id: string, data: any) => api.put(`/inventory/products/${id}`, data).then(res => res.data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`).then(res => res.data),
  restoreProduct: (id: string) => api.post(`/inventory/products/${id}/restore`).then(res => res.data),
  getProductTransactions: (id: string) => api.get(`/stock/transactions/${id}`).then(res => res.data),

  // Variants
  updateVariant: (variantId: string, data: any) => api.put(`/inventory/products/variants/${variantId}`, data).then(res => res.data),
  deleteVariant: (variantId: string) => api.delete(`/inventory/products/variants/${variantId}`).then(res => res.data),
  batchCreateVariants: (productId: string, body: { variants: any[] }) =>
    api.post(`/inventory/products/${productId}/variants/batch`, body).then(res => res.data),

  // Dictionaries
  getCategories: () => api.get('/inventory/categories').then(res => res.data),
  createCategory: (data: any) => api.post('/inventory/categories', data).then(res => res.data),
  getBrands: () => api.get('/inventory/brands').then(res => res.data),
  createBrand: (data: any) => api.post('/inventory/brands', data).then(res => res.data),
  getUnits: () => api.get('/inventory/units').then(res => res.data),
  createUnit: (data: any) => api.post('/inventory/units', data).then(res => res.data),
  getPriceBooks: () => api.get('/inventory/price-books').then(res => res.data),
}
