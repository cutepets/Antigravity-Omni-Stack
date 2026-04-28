import assert from 'node:assert/strict'
import { test } from 'node:test'

const historyModulePath = './inventory-history.ts'
const {
  buildInventoryHistoryRows,
  isSingleProductVariantSet,
  mergeInventoryHistoryStockRows,
} = await import(historyModulePath)

test('builds inbound, outbound, and running stock columns from newest-first transactions', () => {
  const rows = buildInventoryHistoryRows(
    [
      { id: 'tx-out', type: 'OUT', sourceQuantity: -2 },
      { id: 'tx-in', type: 'IN', sourceQuantity: 10 },
    ],
    8,
  )

  assert.deepEqual(
    rows.map((row: any) => ({
      id: row.transaction.id,
      inbound: row.inboundQuantity,
      outbound: row.outboundQuantity,
      balanceAfter: row.balanceAfter,
    })),
    [
      { id: 'tx-out', inbound: 0, outbound: 2, balanceAfter: 8 },
      { id: 'tx-in', inbound: 10, outbound: 0, balanceAfter: 10 },
    ],
  )
})

test('does not expose conversion-rate display logic', () => {
  assert.equal(buildInventoryHistoryRows.length, 2)
})

test('keeps conversion item history in the source unit quantities', () => {
  const rows = buildInventoryHistoryRows(
    [
      { id: 'tx-in', type: 'IN', sourceQuantity: 20 },
    ],
    20,
  )

  assert.equal(rows[0].inboundQuantity, 20)
  assert.equal(rows[0].balanceAfter, 20)
})

test('detects the single technical variant used by simple products', () => {
  assert.equal(isSingleProductVariantSet([{ id: 'variant-1', conversions: null }]), true)
  assert.equal(isSingleProductVariantSet([{ id: 'variant-1', conversions: '{"rate":12}' }]), false)
  assert.equal(isSingleProductVariantSet([{ id: 'variant-1' }, { id: 'variant-2' }]), false)
})

test('merges base product and single-variant stock rows by branch for simple product history', () => {
  const rows = mergeInventoryHistoryStockRows(
    [
      { id: 'base-a', branchId: 'branch-a', stock: 4, reservedStock: 1 },
    ],
    [
      { id: 'variant-a', branchId: 'branch-a', stock: 6, incomingStock: 2 },
      { id: 'variant-b', branchId: 'branch-b', stock: 3 },
    ],
  )

  assert.deepEqual(
    rows.map((row: any) => ({
      branchId: row.branchId,
      stock: row.stock,
      reservedStock: row.reservedStock,
      incomingStock: row.incomingStock,
    })),
    [
      { branchId: 'branch-a', stock: 10, reservedStock: 1, incomingStock: 2 },
      { branchId: 'branch-b', stock: 3, reservedStock: undefined, incomingStock: undefined },
    ],
  )
})
