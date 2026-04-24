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
  label?: string | null
  weightBandId: string | null
  minWeight?: number | null
  maxWeight?: number | null
  sku?: string | null
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
  sku?: string | null
  halfDayPrice: number
  fullDayPrice: number
  isActive: boolean
  weightBand?: ServiceWeightBand
}

export interface HotelDaycarePriceRule {
  id: string
  species: string | null
  weightBandId: string
  packageDays: number
  sku?: string | null
  price: number
  isActive: boolean
  weightBand?: ServiceWeightBand
  weightBandLabel?: string | null
}

export interface HotelExtraService {
  sku?: string | null
  name: string
  minWeight?: number | null
  maxWeight?: number | null
  price: number
}

export interface HolidayCalendarDate {
  id: string
  date: string
  endDate: string | null
  name: string
  year: number
  isRecurring: boolean
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
  label?: string | null
  weightBandId?: string | null
  minWeight?: number | null
  maxWeight?: number | null
  sku?: string | null
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
  sku?: string | null
  fullDayPrice: number
  isActive?: boolean
}

export interface HotelDaycareRulePayload {
  id?: string
  species?: string | null
  weightBandId: string
  packageDays: number
  sku?: string | null
  price: number
  isActive?: boolean
}

export interface HotelExtraServicePayload {
  sku?: string | null
  name: string
  minWeight?: number | null
  maxWeight?: number | null
  price: number
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

  bulkUpsertSpaRules: (data: { species?: string | null; rules: SpaRulePayload[] }) =>
    api.put<SpaPriceRule[]>('/pricing/spa-rules/bulk', data).then((res) => res.data),

  getHotelRules: (params: { species?: string; year?: number; dayType?: PricingDayType; isActive?: boolean }) =>
    api.get<HotelPriceRule[]>('/pricing/hotel-rules', { params }).then((res) => res.data),

  bulkUpsertHotelRules: (rules: HotelRulePayload[]) =>
    api.put<HotelPriceRule[]>('/pricing/hotel-rules/bulk', { rules }).then((res) => res.data),

  getHotelDaycareRules: (params?: { species?: string; packageDays?: number; isActive?: boolean }) =>
    api.get<HotelDaycarePriceRule[]>('/pricing/hotel-daycare-rules', { params }).then((res) => res.data),

  bulkUpsertHotelDaycareRules: (rules: HotelDaycareRulePayload[]) =>
    api.put<HotelDaycarePriceRule[]>('/pricing/hotel-daycare-rules/bulk', { rules }).then((res) => res.data),

  getHotelExtraServices: () =>
    api.get<HotelExtraService[]>('/pricing/hotel-extra-services').then((res) => res.data),

  bulkUpsertHotelExtraServices: (services: HotelExtraServicePayload[]) =>
    api.put<HotelExtraService[]>('/pricing/hotel-extra-services/bulk', { services }).then((res) => res.data),

  getHolidays: (params: { year?: number; isActive?: boolean }) =>
    api.get<HolidayCalendarDate[]>('/pricing/holidays', { params }).then((res) => res.data),

  createHoliday: (data: { startDate: string; endDate: string; name: string; isRecurring?: boolean; isActive?: boolean }) =>
    api.post<HolidayCalendarDate>('/pricing/holidays', data).then((res) => res.data),

  updateHoliday: (id: string, data: Partial<{ startDate: string; endDate: string; name: string; isRecurring: boolean; isActive: boolean }>) =>
    api.patch<HolidayCalendarDate>(`/pricing/holidays/${id}`, data).then((res) => res.data),

  deactivateHoliday: (id: string) =>
    api.delete<HolidayCalendarDate>(`/pricing/holidays/${id}`).then((res) => res.data),

  getSpaServiceImages: () =>
    api.get<Array<{ packageCode: string; imageUrl: string; label?: string }>>('/pricing/spa-service-images').then((res) => res.data),

  uploadSpaServiceImage: (packageCode: string, file: File, label?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (label) formData.append('label', label)
    return api
      .post<{ packageCode: string; imageUrl: string; label?: string }>(`/pricing/spa-service-images/${encodeURIComponent(packageCode)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },
}
