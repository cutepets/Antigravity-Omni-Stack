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

export const inventoryApi = {
  getProducts: (params?: any) => api.get('/inventory/products', { params }).then(res => res.data),
  getProduct: (id: string) => api.get(`/inventory/products/${id}`).then(res => res.data),
  createProduct: (data: any) => api.post('/inventory/products', data).then(res => res.data),
  updateProduct: (id: string, data: any) => api.put(`/inventory/products/${id}`, data).then(res => res.data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`).then(res => res.data),

  // Dictionaries
  getCategories: () => api.get('/inventory/categories').then(res => res.data),
  getBrands: () => api.get('/inventory/brands').then(res => res.data),
  getUnits: () => api.get('/inventory/units').then(res => res.data),
  getPriceBooks: () => api.get('/inventory/price-books').then(res => res.data),
}
