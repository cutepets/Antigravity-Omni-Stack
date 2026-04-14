import { api } from '@/lib/api'

export type HotelStatus =
  | 'BOOKED'
  | 'CHECKED_IN'
  | 'CHECKED_OUT'
  | 'CANCELLED'

export type CageStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE'

export type HotelPaymentStatus = 'UNPAID' | 'PARTIAL' | 'PAID' | 'COMPLETED'
export type HotelLineType = 'REGULAR' | 'HOLIDAY'

export interface HotelRateTable {
  id: string
  name: string
  year: number
  species: string | null
  minWeight: number | null
  maxWeight: number | null
  lineType: HotelLineType
  ratePerNight: number
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface Cage {
  id: string
  name: string
  type: HotelLineType
  description: string | null
  position?: number
  isActive?: boolean
  status: CageStatus
  createdAt: string
  updatedAt: string
  currentStay?: HotelStay | null
  hotelStays?: HotelStay[]
}

export interface HotelStay {
  id: string
  stayCode: string | null
  petId: string
  petName: string
  customerId: string | null
  branchId: string | null
  cageId: string | null
  checkIn: string
  checkedInAt?: string | null
  checkOut: string | null
  checkOutActual: string | null
  estimatedCheckOut: string | null
  cancelledAt?: string | null
  expectedPickup?: string | null
  status: HotelStatus
  lineType: HotelLineType
  price: number | null
  dailyRate: number
  depositAmount: number
  weightAtBooking?: number | null
  weightBandId?: string | null
  pricingSnapshot?: Record<string, unknown> | null
  breakdownSnapshot?: Record<string, unknown> | null
  paymentStatus: HotelPaymentStatus
  notes: string | null
  petNotes: string | null
  promotion: number
  surcharge: number
  totalPrice: number
  rateTableId: string | null
  orderId: string | null
  createdAt: string
  updatedAt: string
  createdBy?: {
    id: string
    fullName: string
    staffCode?: string | null
  } | null
  cage?: Cage | null
  branch?: {
    id: string
    code?: string
    name: string
  } | null
  customer?: {
    id: string
    fullName: string
    phone: string
  } | null
  receiver?: {
    id: string
    fullName: string
    phone: string
  } | null
  slotIndex?: number | null
  accessories?: string | null
  pet?: {
    id: string
    name: string
    breed?: string | null
    species?: string | null
    weight?: number | null
    temperament?: string | null
    allergies?: string | null
    vaccinationStatus?: string | null
    vaccinationNotes?: string | null
    customer?: {
      id: string
      fullName: string
      phone: string
    } | null
  } | null
  order?: {
    id: string
    orderNumber: string
    status: string
    paymentStatus: string
    total: number
    paidAmount: number
    remainingAmount: number
  } | null
  weightBand?: {
    id: string
    label: string
    minWeight: number | null
    maxWeight: number | null
  } | null
  adjustments?: HotelStayAdjustment[]
  chargeLines?: HotelStayChargeLine[]
}

export interface HotelStayAdjustment {
  id: string
  type?: string | null
  label: string
  amount: number
  note?: string | null
  createdAt: string
  updatedAt: string
}

export interface HotelStayTimeline {
  checkpoints: Array<{
    key: string
    label: string
    at: string | null
    user?: {
      id: string
      fullName: string
      staffCode?: string | null
    } | null
  }>
  activities: Array<{
    id: string
    action: string
    target: string | null
    targetId: string | null
    details: Record<string, unknown> | null
    createdAt: string
    user?: {
      id: string
      fullName: string
      staffCode?: string | null
    } | null
  }>
}

export interface HotelStayChargeLine {
  id: string
  label: string
  dayType: HotelLineType
  quantityDays: number
  unitPrice: number
  subtotal: number
  sortOrder: number
  weightBandId: string | null
  pricingSnapshot?: Record<string, unknown> | null
  weightBandLabel?: string | null
}

export interface HotelStayListResponse {
  items: HotelStay[]
  total: number
  page: number
  limit: number
}

export interface CreateCageDto {
  name: string
  type?: HotelLineType
  description?: string
  position?: number
}

export interface UpdateCageDto extends Partial<CreateCageDto> { }

export interface ReorderCagesDto {
  cageIds: string[]
}

export interface CreateHotelStayDto {
  petId: string
  petName?: string
  customerId?: string
  branchId?: string
  cageId?: string
  checkIn: string
  checkOut?: string
  estimatedCheckOut?: string
  lineType?: HotelLineType
  notes?: string
  petNotes?: string
  accessories?: string
  slotIndex?: number
  adjustments?: Array<{
    id?: string
    type?: string
    label: string
    amount: number
    note?: string
  }>
  price?: number
  dailyRate?: number
  depositAmount?: number
  promotion?: number
  surcharge?: number
  totalPrice?: number
  paymentStatus?: HotelPaymentStatus
  rateTableId?: string
  orderId?: string
}

export interface UpdateHotelStayDto extends Partial<CreateHotelStayDto> {
  status?: HotelStatus
}

export interface CheckoutHotelStayDto {
  checkOutActual?: string
  dailyRate?: number
  surcharge?: number
  promotion?: number
  adjustments?: Array<{
    id?: string
    type?: string
    label: string
    amount: number
    note?: string
  }>
  paymentStatus?: HotelPaymentStatus
  notes?: string
}

export interface CalculateHotelPriceDto {
  checkIn: string
  checkOut: string
  species: string
  weight: number
  branchId?: string
  lineType?: HotelLineType
  rateTableId?: string
}

export interface HotelPricePreview {
  totalDays: number
  totalPrice: number
  averageDailyRate: number
  lineType: HotelLineType
  weightBand: {
    id: string | null
    label: string
    minWeight: number | null
    maxWeight: number | null
    source: 'RULE' | 'LEGACY'
  } | null
  chargeLines: Array<{
    label: string
    dayType: HotelLineType
    quantityDays: number
    unitPrice: number
    subtotal: number
    sortOrder: number
    weightBandId: string | null
    pricingSnapshot: Record<string, unknown>
  }>
  pricingSnapshot: Record<string, unknown>
}

export interface CreateHotelRateTableDto {
  name: string
  year: number
  species?: string
  minWeight?: number
  maxWeight?: number
  lineType?: HotelLineType
  ratePerNight: number
}

export interface GetHotelStaysParams {
  status?: string
  paymentStatus?: string
  branchId?: string
  createdById?: string
  customerId?: string
  cageId?: string
  date?: string
  search?: string
  page?: number
  limit?: number
  withMeta?: boolean
  omitBranchId?: boolean
}

export interface GetHotelRateTablesParams {
  year?: number
  lineType?: HotelLineType
  species?: string
  isActive?: boolean
}

export const hotelApi = {
  getCages: () => api.get<Cage[]>('/hotel/cages', { headers: { 'X-Use-Branch-Scope': 'true' } }).then((res) => res.data),
  createCage: (data: CreateCageDto) => api.post<Cage>('/hotel/cages', data).then((res) => res.data),
  updateCage: (id: string, data: UpdateCageDto) => api.patch<Cage>(`/hotel/cages/${id}`, data).then((res) => res.data),
  deleteCage: (id: string) => api.delete<{ success: boolean; message: string }>(`/hotel/cages/${id}`).then((res) => res.data),
  reorderCages: (cageIds: string[]) => api.patch<{ success: boolean }>('/hotel/cages/reorder', { cageIds }).then((res) => res.data),

  getStays: () => api.get<HotelStayListResponse>('/hotel/stays', { params: { limit: 200 }, headers: { 'X-Use-Branch-Scope': 'true' } }).then((res) => res.data.items),
  getStayList: (params?: GetHotelStaysParams) => {
    const { omitBranchId, ...query } = params ?? {}
    return api.get<HotelStayListResponse>('/hotel/stays', {
      params: { ...query, withMeta: true },
      headers: omitBranchId ? undefined : { 'X-Use-Branch-Scope': 'true' },
    }).then((res) => res.data)
  },
  getStay: (id: string) => api.get<HotelStay>(`/hotel/stays/${id}`).then((res) => res.data),
  getStayTimeline: (id: string) => api.get<HotelStayTimeline>(`/hotel/stays/${id}/timeline`).then((res) => res.data),
  createStay: (data: CreateHotelStayDto) => api.post<HotelStay>('/hotel/stays', data).then((res) => res.data),
  updateStay: (id: string, data: UpdateHotelStayDto) => api.patch<HotelStay>(`/hotel/stays/${id}`, data).then((res) => res.data),
  updateStayPayment: (id: string, paymentStatus: HotelPaymentStatus) =>
    api.patch<HotelStay>(`/hotel/stays/${id}/payment`, { paymentStatus }).then((res) => res.data),
  checkoutStay: (id: string, data: CheckoutHotelStayDto) =>
    api.post<HotelStay>(`/hotel/stays/${id}/checkout`, data).then((res) => res.data),
  deleteStay: (id: string) => api.delete<{ success: boolean; message: string }>(`/hotel/stays/${id}`).then((res) => res.data),

  calculatePrice: (data: CalculateHotelPriceDto) =>
    api.post<HotelPricePreview>('/hotel/calculate', data).then((res) => res.data),

  getRateTables: (params?: GetHotelRateTablesParams) =>
    api.get<HotelRateTable[]>('/hotel/rate-tables', { params }).then((res) => res.data),
  getRateTable: (id: string) => api.get<HotelRateTable>(`/hotel/rate-tables/${id}`).then((res) => res.data),
  createRateTable: (data: CreateHotelRateTableDto) =>
    api.post<HotelRateTable>('/hotel/rate-tables', data).then((res) => res.data),
  updateRateTable: (id: string, data: Partial<CreateHotelRateTableDto>) =>
    api.patch<HotelRateTable>(`/hotel/rate-tables/${id}`, data).then((res) => res.data),
  deleteRateTable: (id: string) =>
    api.delete<HotelRateTable | { success: boolean; message: string }>(`/hotel/rate-tables/${id}`).then((res) => res.data),
}
