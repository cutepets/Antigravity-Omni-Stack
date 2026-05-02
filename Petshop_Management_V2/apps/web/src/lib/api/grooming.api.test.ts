import assert from 'node:assert/strict'
import { buildGroomingSessionsRequestConfig } from './grooming-request.utils'

assert.deepEqual(buildGroomingSessionsRequestConfig({ status: 'BOOKED' as any }), {
  params: { status: 'BOOKED' },
  headers: { 'X-Use-Branch-Scope': 'true' },
})

assert.deepEqual(buildGroomingSessionsRequestConfig({ omitBranchId: true, status: 'BOOKED' as any }), {
  params: { status: 'BOOKED' },
})
