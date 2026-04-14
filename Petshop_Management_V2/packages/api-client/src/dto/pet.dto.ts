export interface FindPetsParams {
  page?: number
  limit?: number
  q?: string
  species?: string
  gender?: string
  customerId?: string
}

export interface PetResponse {
  data: {
    id: string
    petCode: string
    name: string
    species: string
    breed?: string
    gender?: string
    birthDate?: string
    color?: string
    weight?: number
    avatar?: string
    isActive: boolean
    customer: { id: string; fullName: string; phone: string }
  }[]
  meta: {
    total: number
    page: number
    limit: number
    totalPages: number
  }
}

export interface CreatePetPayload {
  name: string
  species: string
  customerId: string
  breed?: string
  gender?: 'MALE' | 'FEMALE' | 'UNKNOWN'
  birthDate?: string
  color?: string
  weight?: number
  isActive?: boolean
}

export interface AddVaccinationPayload {
  vaccineName: string
  date: string
  nextDueDate?: string
  notes?: string
}