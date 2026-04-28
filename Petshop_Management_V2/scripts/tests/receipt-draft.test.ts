import assert from 'node:assert/strict'

import { compactLocalReceiptDraftItems } from '../../apps/web/src/app/(dashboard)/inventory/receipts/_components/receipt/receipt-draft'

const largeVariantPayload = 'x'.repeat(1000)
const compacted = compactLocalReceiptDraftItems([
  {
    lineId: 'line-1',
    productId: 'product-1',
    productVariantId: 'variant-1',
    barcode: 'barcode-1',
    sku: 'sku-1',
    name: 'Cat food',
    image: largeVariantPayload,
    unit: 'bag',
    sellingPrice: 120000,
    quantity: 2,
    unitCost: 80000,
    discount: 0,
    note: 'import note',
    totalStock: 10,
    monthlySellThrough: 3,
    branchStocks: [{ branchId: 'branch-1', stock: 10 }],
    variants: [
      {
        id: 'variant-1',
        name: 'Cat food 1kg',
        sku: 'sku-1',
        image: largeVariantPayload,
        branchStocks: [{ branchId: 'branch-1', stock: 10 }],
        children: [
          {
            id: 'variant-child-1',
            name: 'Cat food child',
            image: largeVariantPayload,
          },
        ],
      },
    ],
    variantName: '1kg',
    variantLabel: '1kg',
    unitLabel: 'bag',
    baseSku: 'base-sku',
    baseBarcode: 'base-barcode',
    baseUnit: 'bag',
    baseUnitCost: 70000,
    baseTotalStock: 20,
    baseMonthlySellThrough: 5,
    baseBranchStocks: [{ branchId: 'branch-1', stock: 20 }],
    receivedQuantity: 0,
    returnedQuantity: 0,
    closedQuantity: 0,
  },
])

assert.equal(compacted.length, 1)
assert.equal(compacted[0]?.productId, 'product-1')
assert.equal(compacted[0]?.productVariantId, 'variant-1')
assert.equal(compacted[0]?.quantity, 2)
assert.equal(compacted[0]?.variantLabel, '1kg')
const compactedItem = compacted[0] as any
assert.equal(compactedItem.variants, undefined)
assert.equal(compactedItem.branchStocks, undefined)
assert.equal(compactedItem.baseBranchStocks, undefined)
assert.equal(compactedItem.image, undefined)

const compactJsonSize = JSON.stringify(compacted).length
assert.ok(compactJsonSize < 800, `Expected compact draft below 800 bytes, got ${compactJsonSize}`)
