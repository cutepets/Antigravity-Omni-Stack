import { api } from '@/lib/api'

export type PricingServiceType = 'GROOMING' | 'HOTEL'
export type PricingDayType = 'REGULAR' | 'HOLIDAY'

export interface ServiceWeightBand {
  id: string
  serviceType: PricingServiceType
  species: string | null
  label: string
  minWeight: number
  maxWeight: number | null
  sortOrder: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface SpaPriceRule {
  id: string
  species: string | null
  packageCode: string
  weightBandId: string
  price: number
  durationMinutes: number | null
  isActive: boolean
  weightBand?: ServiceWeightBand
}

export interface HotelPriceRule {
  id: string
  year: number
  species: string | null
  weightBandId: string
  dayType: PricingDayType
  halfDayPrice: number
  fullDayPrice: number
  isActive: boolean
  weightBand?: ServiceWeightBand
}

export interface HolidayCalendarDate {
  id: string
  date: string
  name: string
  year: number
  isActive: boolean
  notes: string | null
}

export interface UpsertWeightBandPayload {
  id?: string
  serviceType: PricingServiceType
  species?: string | null
  label: string
  minWeight: number
  maxWeight?: number | null
  sortOrder?: number
  isActive?: boolean
}

export interface SpaRulePayload {
  id?: string
  species?: string | null
  packageCode: string
  weightBandId: string
  price: number
  durationMinutes?: number | null
  isActive?: boolean
}

export interface HotelRulePayload {
  id?: string
  year: number
  species?: string | null
  weightBandId: string
  dayType: PricingDayType
  halfDayPrice?: number
  fullDayPrice: number
  isActive?: boolean
}

export const pricingApi = {
  getWeightBands: (params: { serviceType: PricingServiceType; species?: string; isActive?: boolean }) =>
    api.get<ServiceWeightBand[]>('/pricing/weight-bands', { params }).then((res) => res.data),

  upsertWeightBand: (data: UpsertWeightBandPayload) =>
    api.post<ServiceWeightBand>('/pricing/weight-bands', data).then((res) => res.data),

  createPresetWeightBands: (data: { serviceType: PricingServiceType; species?: string }) =>
    api.post<ServiceWeightBand[]>('/pricing/weight-bands/presets', data).then((res) => res.data),

  deactivateWeightBand: (id: string) =>
    api.delete<ServiceWeightBand>(`/pricing/weight-bands/${id}`).then((res) => res.data),

  getSpaRules: (params: { species?: string; isActive?: boolean }) =>
    api.get<SpaPriceRule[]>('/pricing/spa-rules', { params }).then((res) => res.data),

  bulkUpsertSpaRules: (rules: SpaRulePayload[]) =>
    api.put<SpaPriceRule[]>('/pricing/spa-rules/bulk', { rules }).then((res) => res.data),

  getHotelRules: (params: { species?: string; year?: number; dayType?: PricingDayType; isActive?: boolean }) =>
    api.get<HotelPriceRule[]>('/pricing/hotel-rules', { params }).then((res) => res.data),

  bulkUpsertHotelRules: (rules: HotelRulePayload[]) =>
    api.put<HotelPriceRule[]>('/pricing/hotel-rules/bulk', { rules }).then((res) => res.data),

  getHolidays: (params: { year?: number; isActive?: boolean }) =>
    api.get<HolidayCalendarDate[]>('/pricing/holidays', { params }).then((res) => res.data),

  createHoliday: (data: { date: string; name: string; notes?: string | null; isActive?: boolean }) =>
    api.post<HolidayCalendarDate>('/pricing/holidays', data).then((res) => res.data),

  updateHoliday: (id: string, data: Partial<{ date: string; name: string; notes: string | null; isActive: boolean }>) =>
    api.patch<HolidayCalendarDate>(`/pricing/holidays/${id}`, data).then((res) => res.data),

  deactivateHoliday: (id: string) =>
    api.delete<HolidayCalendarDate>(`/pricing/holidays/${id}`).then((res) => res.data),
}
