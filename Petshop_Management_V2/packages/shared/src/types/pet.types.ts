import type { PetGender } from './core.types'

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

/**
 * Extended Pet shape as returned by the HTTP API (dates are ISO strings, not Date objects).
 * Use this instead of `Pet as any` in components that consume API responses.
 */
export interface PetProfile {
  id: string
  petCode: string
  name: string
  species: string
  breed?: string | null
  gender: PetGender
  dateOfBirth?: string | null
  weight?: number | null
  color?: string | null
  microchipId?: string | null
  avatar?: string | null
  notes?: string | null
  branchId?: string | null
  customerId: string
  createdAt: string
  updatedAt: string
  temperament?: string | null
  customer?: {
    id: string
    fullName: string
    phone?: string | null
  } | null
  vaccinations?: Array<{
    id: string
    vaccineName: string
    date: string
    nextDueDate?: string | null
    notes?: string | null
    photoUrl?: string | null
  }>
  weightLogs?: Array<{
    id: string
    weight: number
    date: string
    notes?: string | null
  }>
  timeline?: Array<{
    id: string
    action: string
    createdAt: string
    metadata?: Record<string, unknown> | null
  }>
  groomingSessions?: Array<{
    id: string
    sessionCode?: string | null
    startTime?: string | null
    createdAt: string
    status?: string | null
    notes?: string | null
    orderId?: string | null
  }>
  hotelStays?: Array<{
    id: string
    stayCode?: string | null
    checkIn: string
    checkOut?: string | null
    status?: string | null
    lineType?: string | null
  }>
}
