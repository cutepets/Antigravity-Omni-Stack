import assert from 'node:assert/strict'
import { test } from 'node:test'

const priceBooksModulePath = './price-books.ts'
const {
  PRICE_BOOK_QUERY_KEY,
  PRICE_BOOK_QUERY_KEYS,
  extractPriceBooks,
  invalidatePriceBookQueries,
} = await import(priceBooksModulePath)

test('uses the system settings price-book cache key as the canonical key', () => {
  assert.deepEqual(PRICE_BOOK_QUERY_KEY, ['settings', 'inventory', 'price-books'])
  assert.deepEqual(PRICE_BOOK_QUERY_KEYS, [
    ['settings', 'inventory', 'price-books'],
    ['inventory', 'price-books'],
    ['priceBooks'],
  ])
})

test('extracts price books from the API response envelope used by inventory settings', () => {
  const priceBooks = extractPriceBooks({
    data: {
      success: true,
      data: [
        { id: 'retail', name: 'Gia le', sortOrder: 0 },
        { id: 'vip', name: 'Gia VIP', sortOrder: 1 },
      ],
    },
  })

  assert.deepEqual(priceBooks.map((priceBook: { name: string }) => priceBook.name), ['Gia le', 'Gia VIP'])
})

test('invalidates customer-group and legacy price-book query caches together', async () => {
  const invalidated: string[][] = []

  await invalidatePriceBookQueries({
    invalidateQueries: ({ queryKey }: { queryKey: readonly string[] }) => {
      invalidated.push([...queryKey])
    },
  })

  assert.deepEqual(invalidated, PRICE_BOOK_QUERY_KEYS)
})
