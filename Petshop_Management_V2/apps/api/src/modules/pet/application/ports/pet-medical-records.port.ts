import { SyncAttributeType } from '../../dto/sync-attribute.dto.js'

export interface CreateWeightLogInput {
  petId: string
  weight: number
  notes?: string
  date?: Date
}

export interface CreateVaccinationInput {
  petId: string
  vaccineName: string
  date: Date
  nextDueDate?: Date
  notes?: string
  photoUrl?: string
}

export interface AppendPetTimelineEntryInput {
  petId: string
  action: string
  metadata?: Record<string, unknown>
}

export interface IPetMedicalRecords {
  createWeightLog(input: CreateWeightLogInput): Promise<Record<string, unknown>>
  updatePetWeight(petId: string, weight: number): Promise<void>
  createVaccination(input: CreateVaccinationInput): Promise<Record<string, unknown>>
  updateAvatar(petId: string, avatarUrl: string): Promise<Record<string, unknown>>
  appendTimelineEntry(input: AppendPetTimelineEntryInput): Promise<void>
  syncAttribute(attribute: SyncAttributeType, oldValue: string, newValue: string): Promise<number>
}

export const PET_MEDICAL_RECORDS = Symbol('PET_MEDICAL_RECORDS')
