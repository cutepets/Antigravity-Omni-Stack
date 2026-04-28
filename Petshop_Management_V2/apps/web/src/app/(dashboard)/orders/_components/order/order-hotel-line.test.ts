import assert from 'node:assert/strict'
import { test } from 'node:test'

// @ts-expect-error Node's strip-types runner needs the explicit .ts extension for this local test.
import { buildHotelDraftLineFields, formatHotelStayRange, getHotelStatusLabel } from './order-hotel-line.ts'

test('builds saved hotel charge lines from actual days and unit price', () => {
  const fields = buildHotelDraftLineFields({
    quantity: 1,
    unitPrice: 1_760_000,
    hotelStayId: 'stay-1',
    hotelStay: {
      id: 'stay-1',
      stayCode: 'GQBE6V',
      status: 'CHECKED_IN',
      checkIn: '2026-04-24T07:00:00',
      estimatedCheckOut: '2026-04-29T07:00:00',
      checkOutActual: null,
    },
    hotelDetails: {
      checkInDate: '2026-04-24T07:00:00',
      checkOutDate: '2026-04-29T07:00:00',
      chargeQuantityDays: 5.5,
      chargeUnitPrice: 320_000,
      chargeSubtotal: 1_760_000,
    },
  })

  assert.equal(fields.quantity, 5.5)
  assert.equal(fields.unitPrice, 320_000)
  assert.equal(fields.hotelStayId, 'stay-1')
  assert.equal(fields.hotelDetails.stayCode, 'GQBE6V')
  assert.equal(fields.hotelDetails.status, 'CHECKED_IN')
  assert.equal(fields.hotelDetails.checkOutActual, null)
})

test('falls back to hotel pricing snapshot when saved hotel details have no charge line fields', () => {
  const fields = buildHotelDraftLineFields({
    quantity: 1,
    unitPrice: 1_440_000,
    hotelStayId: 'stay-2',
    pricingSnapshot: {
      totalDays: 4.5,
      totalPrice: 1_440_000,
      chargeLines: [
        {
          quantityDays: 4.5,
          unitPrice: 320_000,
          subtotal: 1_440_000,
        },
      ],
    },
    hotelStay: {
      id: 'stay-2',
      stayCode: 'H2604NK001',
      status: 'CHECKED_OUT',
      checkIn: '2026-04-24T11:16:00',
      checkOutActual: '2026-04-28T11:41:00',
    },
    hotelDetails: {
      petId: 'pet-1',
      checkInDate: '2026-04-24T11:16:00',
      checkOutDate: '2026-04-28T11:41:00',
    },
  } as any)

  assert.equal(fields.quantity, 4.5)
  assert.equal(fields.unitPrice, 320_000)
})

test('formats active hotel stay badge and actual in-out range', () => {
  assert.equal(getHotelStatusLabel('CHECKED_IN'), 'Đang trông')
  assert.equal(
    formatHotelStayRange({
      checkIn: '2026-04-24T07:00:00',
      checkOutActual: null,
      status: 'CHECKED_IN',
    }),
    'In: 07:00 24/04/26 - Out: -',
  )
})
