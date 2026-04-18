import axios from 'axios'
import type { LoginResponse, AuthUser } from '@petshop/shared'
import { clearAuthSessionCookie, setAuthSessionCookie } from '@/lib/auth-session-cookie'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  // NOTE: Do NOT set global Content-Type here — FormData requests need multipart
  // with a boundary that axios sets automatically when no Content-Type is forced.
})

// Default JSON for non-FormData requests
api.defaults.headers.common['Content-Type'] = 'application/json'

import { useAuthStore } from '@/stores/auth.store'

// Attach access token from localStorage and Branch ID from store
api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('access_token')
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
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
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: unknown) => void }> = []

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve(token!)
  })
  failedQueue = []
}

api.interceptors.response.use(
  (r) => r,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject })
        })
          .then((token) => {
            originalRequest.headers['Authorization'] = `Bearer ${token}`
            return api(originalRequest)
          })
          .catch((err) => Promise.reject(err))
      }

      originalRequest._retry = true
      isRefreshing = true

      const refreshToken = localStorage.getItem('refresh_token')
      if (!refreshToken) {
        isRefreshing = false
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        clearAuthSessionCookie()
        window.location.href = '/login'
        return Promise.reject(error)
      }

      try {
        const { data } = await axios.post<LoginResponse>(
          `${API_URL}/api/auth/refresh`,
          { refreshToken },
        )
        localStorage.setItem('access_token', data.accessToken)
        localStorage.setItem('refresh_token', data.refreshToken)
        setAuthSessionCookie()
        api.defaults.headers.common['Authorization'] = `Bearer ${data.accessToken}`
        processQueue(null, data.accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`
        return api(originalRequest)
      } catch (refreshError) {
        processQueue(refreshError, null)
        localStorage.removeItem('access_token')
        localStorage.removeItem('refresh_token')
        clearAuthSessionCookie()
        window.location.href = '/login'
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

  refresh: (refreshToken: string) =>
    api.post<LoginResponse>('/auth/refresh', { refreshToken }).then((r) => r.data),

  logout: (refreshToken: string) =>
    api.post('/auth/logout', { refreshToken }).then((r) => r.data),

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
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        const formData = new FormData()
        formData.append('image', file)

        // Native fetch sets multipart/form-data + boundary automatically when body is FormData
        const res = await fetch(`${API_URL}/api/upload/image`, {
            method: 'POST',
            headers: {
                // DO NOT set Content-Type — fetch injects it with the correct boundary
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null
        const formData = new FormData()
        formData.append('file', file)

        const res = await fetch(`${API_URL}/api/upload/file`, {
            method: 'POST',
            headers: {
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
        const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

        const res = await fetch(`${API_URL}/api/upload/file`, {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
