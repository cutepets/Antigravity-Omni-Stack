import axios from 'axios'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const createApiClient = (getAccessToken: () => string | null) => {
  const client = axios.create({
    baseURL: `${API_URL}/api`,
    timeout: 15000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  client.interceptors.request.use((config) => {
    const token = getAccessToken()
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`
    }
    return config
  })

  return client
}

export const defaultApiClient = createApiClient(() => {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('access_token')
})
