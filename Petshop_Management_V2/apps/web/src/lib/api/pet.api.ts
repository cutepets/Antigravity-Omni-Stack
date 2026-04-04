import { api } from '@/lib/api'
import type { Pet, ApiResponse } from '@petshop/shared'

export interface FindPetsParams {
  page?: number
  limit?: number
  q?: string
  species?: string
  gender?: string
  customerId?: string
}

export interface PetResponse {
  data: (Pet & { customer: { id: string; fullName: string; phone: string } })[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export type CreatePetPayload = Omit<Pet, 'id' | 'petCode' | 'createdAt' | 'updatedAt' | 'gender'> & { gender?: 'MALE' | 'FEMALE' | 'UNKNOWN' }

export const petApi = {
  getPets: async (params?: FindPetsParams) => {
    const res = await api.get<PetResponse & { success: boolean }>('/pets', { params })
    return res.data
  },

  getPet: async (id: string) => {
    const res = await api.get<ApiResponse<Pet>>(`/pets/${id}`)
    return res.data.data
  },

  createPet: async (data: CreatePetPayload) => {
    const res = await api.post<ApiResponse<Pet>>('/pets', data)
    return res.data.data
  },

  updatePet: async (data: Partial<CreatePetPayload> & { id: string }) => {
    const { id, ...payload } = data
    const res = await api.put<ApiResponse<Pet>>(`/pets/${id}`, payload)
    return res.data.data
  },

  deletePet: async (id: string) => {
    const res = await api.delete<ApiResponse<{ success: boolean }>>(`/pets/${id}`)
    return res.data.data
  },
}
