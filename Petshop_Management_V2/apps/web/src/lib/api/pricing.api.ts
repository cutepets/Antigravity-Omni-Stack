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

export interface HotelExtraService {
  sku?: string | null
  imageUrl?: string | null
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

export interface HotelExtraServicePayload {
  sku?: string | null
  imageUrl?: string | null
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
    api.get<Array<{ species?: string | null; packageCode: string; imageUrl: string; label?: string }>>('/pricing/spa-service-images').then((res) => res.data),

  uploadSpaServiceImage: (packageCode: string, file: File, label?: string, species?: string | null) => {
    const formData = new FormData()
    formData.append('file', file)
    if (label) formData.append('label', label)
    if (species) formData.append('species', species)
    formData.append('displayName', label || packageCode)
    return api
      .post<{ species?: string | null; packageCode: string; imageUrl: string; label?: string }>(`/pricing/spa-service-images/${encodeURIComponent(packageCode)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },

  uploadPricingServiceImage: (file: File, displayName?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (displayName) formData.append('displayName', displayName)
    return api
      .post<{ imageUrl: string }>('/pricing/service-images/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },

  bulkUpdateSpaServiceImages: (images: Array<{ species?: string | null; packageCode: string; imageUrl: string }>) =>
    api.put<Array<{ species?: string | null; packageCode: string; imageUrl: string }>>('/pricing/spa-service-images', { images }).then((res) => res.data),

  getHotelServiceImages: () =>
    api.get<Array<{ species: string; packageCode: string; imageUrl: string; label?: string }>>('/pricing/hotel-service-images').then((res) => res.data),

  uploadHotelServiceImage: (species: string, file: File, label?: string) => {
    const formData = new FormData()
    formData.append('file', file)
    if (label) formData.append('label', label)
    formData.append('displayName', label || species)
    return api
      .post<{ species: string; packageCode: string; imageUrl: string; label?: string }>(`/pricing/hotel-service-images/${encodeURIComponent(species)}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },

  bulkUpdateHotelServiceImages: (images: Array<{ species?: string | null; packageCode?: string | null; imageUrl: string; label?: string | null }>) =>
    api.put<Array<{ species: string; packageCode: string; imageUrl: string; label?: string }>>('/pricing/hotel-service-images', { images }).then((res) => res.data),

  // ─── Excel Export / Import ──────────────────────────────────────────────

  exportExcel: async (type: 'grooming' | 'hotel' | 'all' = 'all') => {
    const res = await api.get<{ buffer: string; filename: string }>('/pricing/export/xlsx', { params: { type } })
    const { buffer, filename } = res.data
    // Convert base64 to blob and trigger download
    const bytes = atob(buffer)
    const byteArray = new Uint8Array(bytes.length)
    for (let i = 0; i < bytes.length; i++) byteArray[i] = bytes.charCodeAt(i)
    const blob = new Blob([byteArray], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return { filename }
  },

  importExcel: async (file: File) => {
    const formData = new FormData()
    formData.append('file', file)
    return api
      .post<{ imported: number; errors: string[] }>('/pricing/import/xlsx', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      .then((res) => res.data)
  },
}
