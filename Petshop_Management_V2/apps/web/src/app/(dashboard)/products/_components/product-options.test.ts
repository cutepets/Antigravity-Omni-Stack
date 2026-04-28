import assert from 'node:assert/strict'
import { test } from 'node:test'

const productOptionsModulePath = './product-options.ts'
const { getUniqueOptionValues } = await import(productOptionsModulePath)

test('deduplicates option values while preserving first-seen order', () => {
  const values = getUniqueOptionValues([
    { id: 'cat-1', name: 'Sữa tắm' },
    { id: 'cat-2', name: 'Sữa tắm' },
    { value: 'Pate' },
    'Sữa tắm',
    'Hạt',
    { name: '' },
  ])

  assert.deepEqual(values, ['Sữa tắm', 'Pate', 'Hạt'])
})
