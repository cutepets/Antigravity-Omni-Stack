import type { AuthUser } from '@petshop/shared'
import { API_URL, SKIP_AUTH_REDIRECT_HEADER, api } from '@/lib/api/transport'

export { API_URL, SKIP_AUTH_REDIRECT_HEADER, api }

type AuthCookieResponse = {
  success: true
  user: AuthUser
}

export const authApi = {
  login: (username: string, password: string) =>
    api.post<AuthCookieResponse>('/auth/login', { username, password }).then((r) => r.data),

  refresh: () =>
    api.post<AuthCookieResponse>('/auth/refresh', {}).then((r) => r.data),

  logout: () =>
    api.post('/auth/logout', {}).then((r) => r.data),

  me: () => api.get<AuthUser>('/auth/me').then((r) => r.data),
}

export type CashbookCategory = {
  id: string
  type: 'INCOME' | 'EXPENSE'
  name: string
  isActive: boolean
  sortOrder: number
  createdAt: string
  updatedAt: string
}

export const settingsApi = {
  getConfigs: () => api.get('/settings/configs').then((r) => r.data.data),
  updateConfigs: (data: any) => api.put('/settings/configs', data).then((r) => r.data.data),
  getBranches: () => api.get('/settings/branches').then((r) => r.data.data),
  createBranch: (data: any) => api.post('/settings/branches', data).then((r) => r.data.data),
  updateBranch: (id: string, data: any) => api.put(`/settings/branches/${id}`, data).then((r) => r.data.data),
  deleteBranch: (id: string) => api.delete(`/settings/branches/${id}`),
  getCashbookCategories: (type?: 'INCOME' | 'EXPENSE') =>
    api.get('/settings/cashbook-categories', { params: type ? { type } : undefined }).then((r) => r.data.data as CashbookCategory[]),
  createCashbookCategory: (data: { type: 'INCOME' | 'EXPENSE'; name: string }) =>
    api.post('/settings/cashbook-categories', data).then((r) => r.data.data as CashbookCategory),
  updateCashbookCategory: (id: string, data: Partial<{ name: string; isActive: boolean; sortOrder: number }>) =>
    api.put(`/settings/cashbook-categories/${id}`, data).then((r) => r.data.data as CashbookCategory),
  deleteCashbookCategory: (id: string) => api.delete(`/settings/cashbook-categories/${id}`).then((r) => r.data),
}

type UploadOptions = {
  scope?: string
  ownerType?: string
  ownerId?: string
  fieldName?: string
  displayName?: string
}

const appendUploadOptions = (formData: FormData, options?: UploadOptions) => {
  if (!options) return
  if (options.scope) formData.append('scope', options.scope)
  if (options.ownerType) formData.append('ownerType', options.ownerType)
  if (options.ownerId) formData.append('ownerId', options.ownerId)
  if (options.fieldName) formData.append('fieldName', options.fieldName)
  if (options.displayName) formData.append('displayName', options.displayName)
}

export const uploadApi = {
  uploadImage: async (file: File, options?: UploadOptions): Promise<string> => {
    const formData = new FormData()
    formData.append('image', file)
    appendUploadOptions(formData, options)

    const res = await fetch(`${API_URL}/api/upload/image`, {
      method: 'POST',
      credentials: 'include',
      headers: {},
      body: formData,
    })

    const data = await res.json()
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.message || `Upload failed (HTTP ${res.status})`)
    }
    return data.url as string
  },
  uploadFile: async (file: File, options?: UploadOptions): Promise<{ url: string; name: string; assetId?: string; reused?: boolean }> => {
    const formData = new FormData()
    formData.append('file', file)
    appendUploadOptions(formData, options)

    const res = await fetch(`${API_URL}/api/upload/file`, {
      method: 'POST',
      credentials: 'include',
      headers: {},
      body: formData,
    })

    const data = await res.json()
    if (!res.ok || !data.success || !data.url) {
      throw new Error(data.message || `Upload failed (HTTP ${res.status})`)
    }

    return {
      url: data.url as string,
      name: (data.name as string) || file.name,
      assetId: data.assetId as string | undefined,
      reused: Boolean(data.reused),
    }
  },
  deleteFile: async (url: string): Promise<void> => {
    const res = await fetch(`${API_URL}/api/upload/file`, {
      method: 'DELETE',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url }),
    })

    if (res.status === 404) {
      return
    }

    const data = await res.json().catch(() => ({}))
    if (!res.ok || data.success === false) {
      throw new Error(data.message || `Delete file failed (HTTP ${res.status})`)
    }
  },
}

export const activityLogApi = {
  list: (params?: {
    page?: number; limit?: number; userId?: string;
    action?: string; target?: string;
    dateFrom?: string; dateTo?: string; search?: string;
  }) => api.get('/activity-logs', { params }).then((r) => r.data.data),
  stats: () => api.get('/activity-logs/stats').then((r) => r.data.data),
}

export const rolesApi = {
  list: () => api.get('/roles').then((r) => r.data),
  catalog: () => api.get('/roles/permission-catalog').then((r) => r.data),
  create: (data: any) => api.post('/roles', data).then((r) => r.data),
  update: (id: string, data: any) => api.put(`/roles/${id}`, data).then((r) => r.data),
  delete: (id: string) => api.delete(`/roles/${id}`).then((r) => r.data),
}
