import axios from 'axios'
import type { LoginResponse, AuthUser } from '@petshop/shared'
import { clearAuthSessionCookie, setAuthSessionCookie } from '@/lib/auth-session-cookie'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  withCredentials: true,
  // NOTE: Do NOT set global Content-Type here — FormData requests need multipart
  // with a boundary that axios sets automatically when no Content-Type is forced.
})

// Default JSON for non-FormData requests
api.defaults.headers.common['Content-Type'] = 'application/json'

import { useAuthStore } from '@/stores/auth.store'

// Attach Branch ID from store
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const branchId = useAuthStore.getState().activeBranchId
    const method = (config.method ?? 'get').toLowerCase()
    const requestedBranchScope = (config.headers as any)?.['X-Use-Branch-Scope']
    const shouldAttachBranchId =
      typeof requestedBranchScope === 'string'
        ? requestedBranchScope.toLowerCase() === 'true'
        : !['get', 'head', 'options'].includes(method)

    if (branchId && shouldAttachBranchId) {
      config.headers['X-Branch-ID'] = branchId
    } else if (config.headers) {
      delete (config.headers as any)['X-Branch-ID']
    }

    if (config.headers) {
      delete (config.headers as any)['X-Use-Branch-Scope']
    }
  }
  return config
})

// Auto-refresh on 401
let isRefreshing = false
let failedQueue: Array<{ resolve: (value?: void | PromiseLike<void>) => void; reject: (err: unknown) => void }> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve()
  })
  failedQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = String(originalRequest?.url ?? '')
      if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then(() => api(originalRequest))
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      try {
        await axios.post<LoginResponse>(
          `${API_URL}/api/auth/refresh`,
          {},
          {
            withCredentials: true,
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        setAuthSessionCookie()
        processQueue(null)
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError)
        clearAuthSessionCookie()
        if (typeof window !== 'undefined') {
          window.location.href = '/login'
        }
        return Promise.reject(refreshError)
      } finally {
        isRefreshing = false
      }
    }

    return Promise.reject(error)
  },
)

// ---- Auth API calls ----
export const authApi = {
  login: (username: string, password: string) =>
    api.post<LoginResponse>('/auth/login', { username, password }).then((r) => r.data),

  refresh: () =>
    api.post<LoginResponse>('/auth/refresh', {}).then((r) => r.data),

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

// Settings
export const settingsApi = {
    getConfigs: () => api.get('/settings/configs').then(r => r.data.data),
    updateConfigs: (data: any) => api.put('/settings/configs', data).then(r => r.data.data),
    getBranches: () => api.get('/settings/branches').then(r => r.data.data),
    createBranch: (data: any) => api.post('/settings/branches', data).then(r => r.data.data),
    updateBranch: (id: string, data: any) => api.put(`/settings/branches/${id}`, data).then(r => r.data.data),
    deleteBranch: (id: string) => api.delete(`/settings/branches/${id}`),
    getCashbookCategories: (type?: 'INCOME' | 'EXPENSE') =>
      api.get('/settings/cashbook-categories', { params: type ? { type } : undefined }).then(r => r.data.data as CashbookCategory[]),
    createCashbookCategory: (data: { type: 'INCOME' | 'EXPENSE'; name: string }) =>
      api.post('/settings/cashbook-categories', data).then(r => r.data.data as CashbookCategory),
    updateCashbookCategory: (id: string, data: Partial<{ name: string; isActive: boolean; sortOrder: number }>) =>
      api.put(`/settings/cashbook-categories/${id}`, data).then(r => r.data.data as CashbookCategory),
    deleteCashbookCategory: (id: string) => api.delete(`/settings/cashbook-categories/${id}`).then(r => r.data),
}

// Upload — use native fetch to completely bypass axios Content-Type override
export const uploadApi = {
    uploadImage: async (file: File): Promise<string> => {
        const formData = new FormData()
        formData.append('image', file)

        // Native fetch sets multipart/form-data + boundary automatically when body is FormData
        const res = await fetch(`${API_URL}/api/upload/image`, {
            method: 'POST',
            credentials: 'include',
            headers: {
                // DO NOT set Content-Type — fetch injects it with the correct boundary
            },
            body: formData,
        })

        const data = await res.json()
        if (!res.ok || !data.success || !data.url) {
            throw new Error(data.message || `Upload thất bại (HTTP ${res.status})`)
        }
        return data.url as string
    },
    uploadFile: async (file: File): Promise<{ url: string; name: string }> => {
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`${API_URL}/api/upload/file`, {
            method: 'POST',
            credentials: 'include',
            headers: {
            },
            body: formData,
        })

        const data = await res.json()
        if (!res.ok || !data.success || !data.url) {
            throw new Error(data.message || `Upload thất bại (HTTP ${res.status})`)
        }

        return {
            url: data.url as string,
            name: (data.name as string) || file.name,
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
            throw new Error(data.message || `Xoa file that bai (HTTP ${res.status})`)
        }
    },
}

// Lịch sử thao tác
export const activityLogApi = {
    list: (params?: {
        page?: number; limit?: number; userId?: string;
        action?: string; target?: string;
        dateFrom?: string; dateTo?: string; search?: string;
    }) => api.get('/activity-logs', { params }).then(r => r.data.data),
    stats: () => api.get('/activity-logs/stats').then(r => r.data.data),
}

export const rolesApi = {
    list: () => api.get('/roles').then(r => r.data),
    catalog: () => api.get('/roles/permission-catalog').then(r => r.data),
    create: (data: any) => api.post('/roles', data).then(r => r.data),
    update: (id: string, data: any) => api.put(`/roles/${id}`, data).then(r => r.data),
    delete: (id: string) => api.delete(`/roles/${id}`).then(r => r.data),
}
