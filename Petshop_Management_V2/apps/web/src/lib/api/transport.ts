import axios from 'axios'
import type { LoginResponse } from '@petshop/shared'
import { clearAuthSessionCookie, setAuthSessionCookie } from '@/lib/auth-session-cookie'
import { useAuthStore } from '@/stores/auth.store'

export const API_URL = process.env['NEXT_PUBLIC_API_URL']?.replace(/\/+$/, '') ?? ''

export const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
  withCredentials: true,
  // Do not set global Content-Type here. FormData requests need the
  // multipart boundary that axios sets only when Content-Type is omitted.
})

api.defaults.headers.common['Content-Type'] = 'application/json'

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

let isRefreshing = false
let failedQueue: Array<{ resolve: (value?: void | PromiseLike<void>) => void; reject: (err: unknown) => void }> = []

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error)
    else prom.resolve()
  })
  failedQueue = []
}

function isPublicAuthPage() {
  if (typeof window === 'undefined') return false

  return ['/login', '/forgot-password'].some((route) => {
    const pathname = window.location.pathname
    return pathname === route || pathname.startsWith(`${route}/`)
  })
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config

    if (error.response?.status === 401 && !originalRequest._retry) {
      const requestUrl = String(originalRequest?.url ?? '')
      if (requestUrl.includes('/auth/login') || requestUrl.includes('/auth/refresh')) {
        return Promise.reject(error)
      }

      if (isPublicAuthPage()) {
        clearAuthSessionCookie()
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
        if (typeof window !== 'undefined' && !isPublicAuthPage()) {
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
