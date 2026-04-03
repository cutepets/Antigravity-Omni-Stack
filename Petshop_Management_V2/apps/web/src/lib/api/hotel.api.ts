import { api } from '../api.js'

export type HotelStatus = 'AVAILABLE' | 'OCCUPIED' | 'MAINTENANCE' | 'COMPLETED'
export type HotelLineType = 'REGULAR' | 'HOLIDAY'

export interface Cage {
  id: string
  name: string
  type: HotelLineType
  description: string | null
  status: HotelStatus
  createdAt: string
  updatedAt: string
}

export interface HotelStay {
  id: string
  petId: string
  petName: string
  customerId: string | null
  cageId: string | null
  checkIn: string
  checkOut: string | null
  estimatedCheckOut: string | null
  notes: string | null
  status: HotelStatus
  price: number
  lineType: HotelLineType
  orderId: string | null
  createdAt: string
  updatedAt: string
  
  cage?: Cage
  pet?: {
    id: string
    name: string
    breed: string
    species: string
  }
}

export interface CreateCageDto {
  name: string
  type?: HotelLineType
  description?: string
}

export interface UpdateCageDto extends Partial<CreateCageDto> {
  status?: HotelStatus
}

export interface CreateHotelStayDto {
  petId: string
  petName: string
  customerId?: string
  cageId?: string
  checkIn: string
  checkOut?: string
  estimatedCheckOut?: string
  lineType?: HotelLineType
  notes?: string
  price?: number
}

export interface UpdateHotelStayDto extends Partial<CreateHotelStayDto> {
  status?: HotelStatus
  orderId?: string
}

export const hotelApi = {
  // Cages
  getCages: () => api.get<Cage[]>('/hotel/cages').then((res) => res.data),
  createCage: (data: CreateCageDto) => api.post<Cage>('/hotel/cages', data).then((res) => res.data),
  updateCage: (id: string, data: UpdateCageDto) =>
    api.patch<Cage>(`/hotel/cages/${id}`, data).then((res) => res.data),
  deleteCage: (id: string) => api.delete<{ success: boolean; message: string }>(`/hotel/cages/${id}`).then((res) => res.data),

  // Stays
  getStays: () => api.get<HotelStay[]>('/hotel/stays').then((res) => res.data),
  createStay: (data: CreateHotelStayDto) =>
    api.post<HotelStay>('/hotel/stays', data).then((res) => res.data),
  updateStay: (id: string, data: UpdateHotelStayDto) =>
    api.patch<HotelStay>(`/hotel/stays/${id}`, data).then((res) => res.data),
  deleteStay: (id: string) => api.delete<{ success: boolean; message: string }>(`/hotel/stays/${id}`).then((res) => res.data),
}
