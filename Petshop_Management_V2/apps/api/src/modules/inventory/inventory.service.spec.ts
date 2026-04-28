import { InventoryService } from './inventory.service.js'

describe('InventoryService', () => {
  it('adds incoming and reserved quantities to product branch stocks', async () => {
    const db = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-1',
            name: 'Cat litter',
            branchStocks: [
              {
                id: 'stock-1',
                branchId: 'branch-1',
                productId: 'product-1',
                productVariantId: null,
                stock: 10,
                reservedStock: 1,
                minStock: 5,
              },
            ],
            variants: [],
          },
        ]),
        count: jest.fn().mockResolvedValue(1),
      },
      stockReceiptItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            productId: 'product-1',
            productVariantId: null,
            quantity: 7,
            receivedQuantity: 2,
            closedQuantity: 1,
            receipt: {
              branchId: 'branch-1',
              status: 'DRAFT',
              receiptStatus: 'DRAFT',
            },
          },
        ]),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([
          {
            productId: 'product-1',
            productVariantId: null,
            quantity: 3,
            stockExportedAt: null,
            order: {
              branchId: 'branch-1',
              status: 'PROCESSING',
            },
          },
        ]),
      },
    }
    const service = new InventoryService(db as any)

    const result = await service.findAllProducts({ page: 1, limit: 20 })

    expect(result.data[0].branchStocks[0]).toEqual(
      expect.objectContaining({
        stock: 10,
        reservedStock: 4,
        incomingStock: 4,
      }),
    )
  })
})
