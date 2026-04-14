import axios from 'axios'

const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'

export const apiClient = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 15000,
})

apiClient.defaults.headers.common['Content-Type'] = 'application/json'

export default apiClient