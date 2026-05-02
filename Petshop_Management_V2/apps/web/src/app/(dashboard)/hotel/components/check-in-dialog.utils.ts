import type { CreateHotelStayDto, UpdateHotelStayDto } from '@/lib/api/hotel.api'

type CheckInFormValues = {
  slotIndex?: number | null
  notes: string
  accessories: string
  estimatedCheckOut: string
}

type NewStayCheckInValues = CheckInFormValues & {
  petId: string
  petName: string
  now?: Date
}

function toOptionalIsoDate(value: string) {
  return value ? new Date(value).toISOString() : undefined
}

export function buildBookedStayCheckInPayload(values: CheckInFormValues): UpdateHotelStayDto {
  return {
    status: 'CHECKED_IN',
    slotIndex: values.slotIndex ?? undefined,
    notes: values.notes,
    accessories: values.accessories,
    estimatedCheckOut: toOptionalIsoDate(values.estimatedCheckOut),
  }
}

export function buildNewStayCheckInPayload(values: NewStayCheckInValues): CreateHotelStayDto {
  return {
    slotIndex: values.slotIndex ?? undefined,
    petId: values.petId,
    petName: values.petName,
    lineType: 'REGULAR',
    checkIn: (values.now ?? new Date()).toISOString(),
    estimatedCheckOut: toOptionalIsoDate(values.estimatedCheckOut),
    notes: values.notes,
    accessories: values.accessories,
  }
}
