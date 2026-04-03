import { api } from '@/lib/api'

export const settingsApi = {
  getConfigs: async (keys?: string[]): Promise<Record<string, any>> => {
    const { data } = await api.get('/settings', { params: { keys: keys?.join(',') } })
    if (data.success) {
        // Assume API returns { success: true, data: { key: value, ... } }
        return data.data
    }
    return {}
  },
  
  updateConfigs: async (payload: Record<string, any>) => {
    const { data } = await api.put('/settings', payload)
    return data
  }
}
