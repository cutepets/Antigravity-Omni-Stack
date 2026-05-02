import test from 'node:test'
import assert from 'node:assert/strict'
// TypeScript disallows `.ts` specifiers here without a project-wide flag, but Node needs it for direct test execution.
// @ts-ignore TS5097
import { deriveCheckInDialogDefaults } from './check-in-dialog.utils.ts'

test('leaves estimated checkout blank for booked stays until staff chooses a date', () => {
  const defaults = deriveCheckInDialogDefaults({
    petName: 'B Trang',
    lineType: 'REGULAR',
    notes: 'Needs quiet room',
    accessories: 'Leash',
    estimatedCheckOut: '2026-05-10T08:00:00.000Z',
  } as any)

  assert.deepEqual(defaults, {
    petName: 'B Trang',
    lineType: 'REGULAR',
    notes: 'Needs quiet room',
    accessories: 'Leash',
    estimatedCheckOut: '',
  })
})

test('returns empty defaults when there is no booked stay', () => {
  assert.deepEqual(deriveCheckInDialogDefaults(null), {
    petName: '',
    lineType: 'REGULAR',
    notes: '',
    accessories: '',
    estimatedCheckOut: '',
  })
})
