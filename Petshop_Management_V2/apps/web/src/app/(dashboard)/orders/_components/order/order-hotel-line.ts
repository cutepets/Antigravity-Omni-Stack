type HotelDraftSource = {
  quantity?: number | string | null
  unitPrice?: number | string | null
  hotelStayId?: string | null
  hotelStay?: any
  hotelDetails?: any
  pricingSnapshot?: any
}

const HOTEL_STATUS_LABEL: Record<string, string> = {
  BOOKED: 'Đã đặt',
  CHECKED_IN: 'Đang trông',
  CHECKED_OUT: 'Đã trả',
  CANCELLED: 'Đã hủy',
}

function numberOrFallback(value: unknown, fallback: number) {
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
}

function getChargeLines(value: any) {
  return Array.isArray(value?.chargeLines) ? value.chargeLines : []
}

function resolveHotelChargeLine(item: HotelDraftSource) {
  const details = item.hotelDetails ?? {}
  const stay = item.hotelStay ?? {}
  const directChargeLine = {
    quantityDays: details.chargeQuantityDays,
    unitPrice: details.chargeUnitPrice,
    subtotal: details.chargeSubtotal,
  }
  if (Number(directChargeLine.quantityDays) > 0 || Number(directChargeLine.unitPrice) > 0) {
    return directChargeLine
  }

  const snapshots = [
    item.pricingSnapshot,
    stay.breakdownSnapshot,
    stay.pricingSnapshot,
    details.pricingPreview,
  ].filter(Boolean)

  for (const snapshot of snapshots) {
    if (snapshot?.chargeLine) return snapshot.chargeLine

    const chargeLines = getChargeLines(snapshot)
    if (chargeLines.length === 1) return chargeLines[0]

    const totalDays = numberOrFallback(snapshot?.totalDays, 0)
    const totalPrice = numberOrFallback(snapshot?.totalPrice ?? snapshot?.baseTotalPrice, 0)
    if (totalDays > 0 && totalPrice > 0) {
      return {
        quantityDays: totalDays,
        unitPrice: totalPrice / totalDays,
        subtotal: totalPrice,
      }
    }
  }

  return directChargeLine
}

export function getHotelStatusLabel(status?: string | null) {
  if (!status) return 'Hotel'
  return HOTEL_STATUS_LABEL[status] ?? status
}

export function buildHotelDraftLineFields(item: HotelDraftSource) {
  const details = item.hotelDetails ?? {}
  const stay = item.hotelStay ?? {}
  const chargeLine = resolveHotelChargeLine(item)
  const quantity = numberOrFallback(chargeLine.quantityDays, numberOrFallback(item.quantity, 1))
  const unitPrice = numberOrFallback(chargeLine.unitPrice, numberOrFallback(item.unitPrice, 0))
  const hotelStayId = item.hotelStayId ?? details.stayId ?? stay.id ?? undefined

  return {
    quantity,
    unitPrice,
    hotelStayId,
    hotelStay: item.hotelStay ?? undefined,
    hotelDetails: {
      ...details,
      stayId: hotelStayId,
      stayCode: stay.stayCode ?? details.stayCode ?? null,
      status: stay.status ?? details.status ?? null,
      checkIn: stay.checkedInAt ?? stay.checkIn ?? details.checkIn ?? details.checkInDate,
      checkedInAt: stay.checkedInAt ?? details.checkedInAt ?? null,
      estimatedCheckOut: stay.estimatedCheckOut ?? details.estimatedCheckOut ?? details.checkOutDate ?? null,
      checkOutActual: stay.checkOutActual ?? details.checkOutActual ?? null,
      chargeQuantityDays: chargeLine.quantityDays ?? details.chargeQuantityDays,
      chargeUnitPrice: chargeLine.unitPrice ?? details.chargeUnitPrice,
      chargeSubtotal: chargeLine.subtotal ?? details.chargeSubtotal,
    },
  }
}

function formatShortDateTime(value?: string | null) {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'

  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date)
  const datePart = new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  }).format(date)

  return `${time} ${datePart}`
}

export function formatHotelStayRange(details?: {
  checkIn?: string | null
  checkedInAt?: string | null
  checkOutActual?: string | null
  status?: string | null
}) {
  const inValue = details?.checkedInAt ?? details?.checkIn ?? null
  const outValue = details?.status === 'CHECKED_OUT' ? details?.checkOutActual ?? null : null
  return `In: ${formatShortDateTime(inValue)} - Out: ${formatShortDateTime(outValue)}`
}
