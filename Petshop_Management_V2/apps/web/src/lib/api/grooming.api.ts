import { api } from '@/lib/api'
import type { ApiResponse } from '@petshop/shared'

export interface GroomingSession {
  id: string
  petId: string
  petName: string
  customerId: string | null
  staffId: string | null
  serviceId: string | null
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  startTime: string | null
  endTime: string | null
  notes: string | null
  price: number | null
  createdAt: string
  pet: any
  staff: any
}

export type CreateGroomingPayload = {
  petId: string
  staffId?: string
  serviceId?: string
  startTime?: string
  notes?: string
}

export type UpdateGroomingPayload = Partial<CreateGroomingPayload> & {
  id: string
  status?: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED'
  endTime?: string
  price?: number
}

export const groomingApi = {
  getSessions: async () => {
    const res = await api.get<ApiResponse<GroomingSession[]>>('/grooming')
    return res.data.data
  },

  getSession: async (id: string) => {
    const res = await api.get<ApiResponse<GroomingSession>>(`/grooming/${id}`)
    return res.data.data
  },

  createSession: async (data: CreateGroomingPayload) => {
    const res = await api.post<ApiResponse<GroomingSession>>('/grooming', data)
    return res.data.data
  },

  updateSession: async (data: UpdateGroomingPayload) => {
    const { id, ...payload } = data
    const res = await api.patch<ApiResponse<GroomingSession>>(`/grooming/${id}`, payload)
    return res.data.data
  },

  deleteSession: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean }>>(`/grooming/${id}`)
    return res.data.data
  },
}
