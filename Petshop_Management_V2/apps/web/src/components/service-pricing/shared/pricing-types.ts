import type { PricingDayType } from '@/lib/api/pricing.api'

export type PricingMode = 'HOTEL' | 'GROOMING'

export type BandDraft = {
  key: string
  id: string | null
  label: string
  minWeight: string
  maxWeight: string
  sortOrder: string
}

export type SpaServiceColumn = {
  key: string
  packageCode: string
}

export type SpaDraft = {
  id?: string
  sku: string
  price: string
  durationMinutes: string
}

export type FlatRateDraft = {
  key: string
  id?: string
  sku: string
  name: string
  minWeight: string
  maxWeight: string
  price: string
  durationMinutes: string
}

export type HotelExtraServiceDraft = {
  key: string
  sku: string
  name: string
  minWeight: string
  maxWeight: string
  price: string
}

export type HotelDraft = {
  id?: string
  sku: string
  fullDayPrice: string
}

export type HolidayDraft = {
  startDate: string
  endDate: string
  name: string
  isRecurring: boolean
}

export type DayTypeOption = {
  value: PricingDayType
  label: string
  hint: string
}
