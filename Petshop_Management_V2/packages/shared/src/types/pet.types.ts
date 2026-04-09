import type { PetGender } from './core.types.js'

export interface Pet {
  id: string
  petCode: string
  name: string
  species: string
  breed?: string | null
  gender: PetGender
  dateOfBirth?: Date | null
  weight?: number | null
  color?: string | null
  microchipId?: string | null
  avatar?: string | null
  notes?: string | null
  branchId?: string | null
  customerId: string
  createdAt: Date
  updatedAt: Date
}

export interface PetWeightLog {
  id: string
  petId: string
  weight: number
  date: Date
  notes?: string | null
  createdAt: Date
}

export interface PetVaccination {
  id: string
  petId: string
  vaccineName: string
  date: Date
  nextDueDate?: Date | null
  notes?: string | null
  createdAt: Date
}

export interface PetHealthNote {
  id: string
  petId: string
  content: string
  date: Date
  createdAt: Date
}
