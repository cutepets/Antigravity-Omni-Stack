import assert from 'node:assert/strict'
import { buildBookedStayCheckInPayload, buildNewStayCheckInPayload } from './check-in-dialog.utils'

const bookedPayload = buildBookedStayCheckInPayload({
  slotIndex: 3,
  notes: 'Canh gio an',
  accessories: 'Long van chuyen',
  estimatedCheckOut: '2026-05-03',
})

assert.deepEqual(bookedPayload, {
  status: 'CHECKED_IN',
  slotIndex: 3,
  notes: 'Canh gio an',
  accessories: 'Long van chuyen',
  estimatedCheckOut: '2026-05-03T00:00:00.000Z',
})

const newStayPayload = buildNewStayCheckInPayload({
  slotIndex: null,
  petId: 'pet-1',
  petName: 'Beo',
  notes: '',
  accessories: 'Day deo',
  estimatedCheckOut: '',
  now: new Date('2026-05-02T06:56:00.000Z'),
})

assert.equal(newStayPayload.accessories, 'Day deo')
assert.equal(newStayPayload.notes, '')
assert.equal(newStayPayload.checkIn, '2026-05-02T06:56:00.000Z')
