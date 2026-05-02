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

  it('exports only the requested product page and selected columns', async () => {
    const db = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'product-1',
            name: 'Cat food',
            groupCode: 'CAT-FOOD',
            sku: 'CAT-FOOD',
            unit: 'bag',
            price: 120000,
            costPrice: 80000,
            category: 'Food',
            isActive: true,
            branchStocks: [],
            variants: [],
          },
        ]),
        count: jest.fn().mockResolvedValue(3),
      },
      priceBook: {
        findMany: jest.fn().mockResolvedValue([{ id: 'retail', name: 'Gia le', isDefault: true, sortOrder: 1 }]),
      },
      stockReceiptItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new InventoryService(db as any)

    const result = await service.exportProducts({
      scope: 'page',
      filters: { page: 2, limit: 1, category: 'Food' },
      columns: ['groupCode', 'sku', 'productName'],
      priceBookColumns: [],
    })

    expect(db.product.findMany).toHaveBeenCalledWith(expect.objectContaining({
      skip: 1,
      take: 1,
    }))
    expect(result.data.rows).toEqual([
      {
        groupCode: 'CAT-FOOD',
        sku: 'CAT-FOOD',
        productName: 'Cat food',
        priceBookValues: {},
      },
    ])
    expect(result.data.summary).toEqual(expect.objectContaining({
      scope: 'page',
      productCount: 1,
      rowCount: 1,
    }))
  })

  it('exports only selected product IDs when scope is selected', async () => {
    const db = {
      product: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'product-1', name: 'Cat food', groupCode: 'CAT-FOOD', sku: 'CAT-FOOD', unit: 'bag', price: 120000, branchStocks: [], variants: [] },
          { id: 'product-2', name: 'Dog food', groupCode: 'DOG-FOOD', sku: 'DOG-FOOD', unit: 'bag', price: 150000, branchStocks: [], variants: [] },
        ]),
        count: jest.fn().mockResolvedValue(2),
      },
      priceBook: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      stockReceiptItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      orderItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    }
    const service = new InventoryService(db as any)

    const result = await service.exportProducts({
      scope: 'selected',
      productIds: ['product-2'],
      columns: ['groupCode', 'productName'],
    })

    expect(result.data.rows).toEqual([
      expect.objectContaining({ groupCode: 'DOG-FOOD', productName: 'Dog food' }),
    ])
    expect(result.data.rows).toHaveLength(1)
  })
})
