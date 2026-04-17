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

export interface AddVaccinationPayload {
  vaccineName: string
  date: string
  nextDueDate?: string
  notes?: string
}

export const petApi = {
  getPets: async (params?: FindPetsParams) => {
    const res = await api.get<PetResponse & { success: boolean }>('/pets', { params })
    return res.data
  },

  getPet: async (id: string) => {
    const res = await api.get<ApiResponse<Pet>>(`/pets/${id}`)
    return res.data.data
  },

  getActivePetServices: async (petId: string) => {
    const res = await api.get(`/pets/${petId}/active-services`);
    return res.data?.data ?? res.data;
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

  addWeightLog: async (petId: string, payload: { weight: number; notes?: string; date?: string }) => {
    const res = await api.post<ApiResponse<any>>(`/pets/${petId}/weight`, payload)
    return res.data.data
  },

  addVaccination: async (petId: string, payload: AddVaccinationPayload) => {
    const res = await api.post<ApiResponse<any>>(`/pets/${petId}/vaccinations`, payload)
    return res.data.data
  },

  uploadAvatar: async (id: string, file: File) => {
    const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/api/pets/${id}/avatar`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Upload thất bại')
    return data.data
  },

  uploadVaccinePhoto: async (petId: string, file: File) => {
    const API_URL = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001'
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null

    const formData = new FormData()
    formData.append('file', file)

    const res = await fetch(`${API_URL}/api/pets/${petId}/vaccinations/photo`, {
      method: 'POST',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: formData,
    })

    const data = await res.json()
    if (!res.ok) throw new Error(data.message || 'Upload thất bại')
    return data.data
  },

  syncAttribute: async (payload: { attribute: 'breed' | 'temperament'; oldValue: string; newValue: string }) => {
    const res = await api.post<ApiResponse<{ success: boolean; count: number }>>('/pets/sync-attribute', payload)
    return res.data.data
  },
}
