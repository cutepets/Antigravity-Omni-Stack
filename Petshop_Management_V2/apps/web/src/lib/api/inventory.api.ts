import { api } from '@/lib/api'

export type ProductExcelRowType = 'VARIANT' | 'CONVERSION'
export type ProductImportMode = 'update' | 'create'
export type ProductExportScope = 'all' | 'filtered' | 'selected'

export interface ProductExcelRow {
  groupCode?: string | null
  rowType?: ProductExcelRowType | null
  sku?: string | null
  sourceSku?: string | null
  productName?: string | null
  attributeName1?: string | null
  attributeValue1?: string | null
  attributeName2?: string | null
  attributeValue2?: string | null
  attributeName3?: string | null
  attributeValue3?: string | null
  baseUnit?: string | null
  rowUnit?: string | null
  conversionRate?: number | null
  barcode?: string | null
  category?: string | null
  brand?: string | null
  importName?: string | null
  targetSpecies?: string | null
  costPrice?: number | null
  vat?: number | null
  weight?: number | null
  minStock?: number | null
  tags?: string | null
  isActive?: boolean | null
  lastCountShift?: string | null
  imageUrl?: string | null
  price?: number | null
  priceBookValues?: Record<string, number | string | null | undefined> | null
}

export interface ProductImportPreviewItem {
  rowNumber: number
  groupCode: string
  sku: string
  rowType: ProductExcelRowType
  action: 'create' | 'update' | 'skip'
  messages: string[]
}

export interface ProductImportPreviewResult {
  mode: ProductImportMode
  canCommit: boolean
  summary: {
    totalRows: number
    validRows: number
    skippedRows: number
    errorCount: number
    warningCount: number
    groupCount: number
    createCount: number
    updateCount: number
    skipCount: number
  }
  items: ProductImportPreviewItem[]
  groups: Array<{
    groupCode: string
    rowCount: number
    valid: boolean
    action: 'create' | 'update' | 'skip'
    messages: string[]
  }>
}

export interface ProductImportRequest {
  mode: ProductImportMode
  rows: ProductExcelRow[]
  includedColumns?: string[]
  priceBookHeaders?: string[]
}

export interface BulkDeleteResult {
  success: boolean
  deletedIds: string[]
  blocked: Array<{ id: string; reason: string }>
}

export type BulkUpdateProductPayload = Partial<Pick<ProductExcelRow,
  'category' | 'brand' | 'price' | 'costPrice' | 'minStock' | 'lastCountShift'
>> & { unit?: string; isActive?: boolean }

export const inventoryApi = {
  getProducts: (params?: any, config?: any) => api.get('/inventory/products', { params, ...config }).then(res => res.data),
  getProduct: (id: string) => api.get(`/inventory/products/${id}`).then(res => res.data),
  createProduct: (data: any) => api.post('/inventory/products', data).then(res => res.data),
  updateProduct: (id: string, data: any) => api.put(`/inventory/products/${id}`, data).then(res => res.data),
  deleteProduct: (id: string) => api.delete(`/inventory/products/${id}`).then(res => res.data),
  bulkDeleteProducts: (ids: string[]) => api.post<BulkDeleteResult>('/inventory/products/bulk-delete', { ids }).then(res => res.data),
  bulkUpdateProducts: (ids: string[], updates: BulkUpdateProductPayload) =>
    api.patch<{ success: boolean; updatedIds: string[]; updatedCount: number }>('/inventory/products/bulk-update', { ids, updates }).then(res => res.data),
  restoreProduct: (id: string) => api.post(`/inventory/products/${id}/restore`).then(res => res.data),
  getProductTransactions: (id: string, params?: { variantId?: string; variantScope?: 'base'; branchId?: string }) =>
    api.get(`/stock/transactions/${id}`, { params }).then(res => res.data),

  updateVariant: (variantId: string, data: any) => api.put(`/inventory/products/variants/${variantId}`, data).then(res => res.data),
  deleteVariant: (variantId: string) => api.delete(`/inventory/products/variants/${variantId}`).then(res => res.data),
  batchCreateVariants: (productId: string, body: { variants: any[] }) =>
    api.post(`/inventory/products/${productId}/variants/batch`, body).then(res => res.data),

  getCategories: () => api.get('/inventory/categories').then(res => res.data),
  createCategory: (data: any) => api.post('/inventory/categories', data).then(res => res.data),
  getBrands: () => api.get('/inventory/brands').then(res => res.data),
  createBrand: (data: any) => api.post('/inventory/brands', data).then(res => res.data),
  getUnits: () => api.get('/inventory/units').then(res => res.data),
  createUnit: (data: any) => api.post('/inventory/units', data).then(res => res.data),
  getPriceBooks: () => api.get('/inventory/price-books').then(res => res.data),

  exportProducts: (body: { scope: ProductExportScope; filters?: Record<string, any>; productIds?: string[] }) =>
    api.post('/inventory/products/export', body).then(res => res.data),
  previewProductImport: (body: ProductImportRequest) =>
    api.post('/inventory/products/import/preview', body).then(res => res.data),
  commitProductImport: (body: ProductImportRequest) =>
    api.post('/inventory/products/import/commit', body).then(res => res.data),
}
