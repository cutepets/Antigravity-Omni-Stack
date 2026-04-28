import assert from 'node:assert/strict'
import { test } from 'node:test'

// @ts-expect-error Node's strip-types runner needs the explicit .ts extension for this local test.
import { buildOrderServiceDetailHref } from './order-service-links.ts'

test('builds a grooming deep-link that opens the session detail dialog', () => {
  assert.equal(
    buildOrderServiceDetailHref({
      kind: 'grooming',
      id: 'session-123',
      code: 'S2604NK003',
    }),
    '/grooming?view=list&search=S2604NK003&sessionId=session-123',
  )
})

test('builds a hotel deep-link that opens the stay detail dialog', () => {
  assert.equal(
    buildOrderServiceDetailHref({
      kind: 'hotel',
      id: 'stay-456',
      code: 'H2604NK001',
    }),
    '/hotel?view=list&search=H2604NK001&stayId=stay-456',
  )
})
