import { OrderInventoryService } from './order-inventory.service.js';

describe('OrderInventoryService', () => {
  const buildStockTx = (branchStock: { id: string; stock: number } | null = { id: 'stock-1', stock: 10 }) => ({
    product: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'product-1',
        name: 'Pate',
        sku: 'PATE',
        variants: [],
      }),
    },
    productVariant: {
      findUnique: jest.fn(),
    },
    branch: {
      findUnique: jest.fn().mockResolvedValue({ id: 'branch-1', code: 'BR1', name: 'Branch 1' }),
      findFirst: jest.fn(),
    },
    branchStock: {
      findFirst: jest.fn().mockResolvedValue(branchStock),
      update: jest.fn(),
      create: jest.fn(),
    },
    stockTransaction: {
      create: jest.fn(),
    },
  });

  it('groups completed product sales by product, variant, branch scope, and day', async () => {
    const tx = {
      productSalesDaily: {
        upsert: jest.fn(),
      },
    };
    const service = new OrderInventoryService({ getProducts: jest.fn() } as any);

    const completedAt = new Date('2026-04-25T15:30:00.000Z');
    const expectedBucket = new Date(completedAt);
    expectedBucket.setHours(0, 0, 0, 0);

    await service.applyCompletedProductSalesDelta(tx as any, {
      completedAt,
      branchId: 'branch-1',
      items: [
        { productId: 'product-1', productVariantId: 'variant-1', quantity: 2, subtotal: 200_000 },
        { productId: 'product-1', productVariantId: 'variant-1', quantity: 1, subtotal: 100_000 },
        { productId: 'product-2', quantity: 1, subtotal: 50_000 },
        { productId: null, quantity: 9, subtotal: 999_000 },
      ],
    });

    expect(tx.productSalesDaily.upsert).toHaveBeenCalledTimes(2);
    expect(tx.productSalesDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_branchScope_salesKey: {
            date: expectedBucket,
            branchScope: 'branch-1',
            salesKey: 'variant:variant-1',
          },
        },
        create: expect.objectContaining({
          productId: 'product-1',
          productVariantId: 'variant-1',
          quantitySold: 3,
          revenue: 300_000,
        }),
        update: expect.objectContaining({
          quantitySold: { increment: 3 },
          revenue: { increment: 300_000 },
        }),
      }),
    );
    expect(tx.productSalesDaily.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          date_branchScope_salesKey: {
            date: expectedBucket,
            branchScope: 'branch-1',
            salesKey: 'product:product-2',
          },
        },
        create: expect.objectContaining({
          productId: 'product-2',
          productVariantId: null,
          quantitySold: 1,
          revenue: 50_000,
        }),
      }),
    );
  });

  it('deducts branch stock and records an OUT stock transaction', async () => {
    const tx = buildStockTx();
    const service = new OrderInventoryService({ getProducts: jest.fn() } as any);

    await service.deductProductBranchStock(tx as any, {
      branchId: 'branch-1',
      productId: 'product-1',
      quantity: 3,
      orderId: 'order-1',
      reason: 'Xuất bán',
      staffId: 'staff-1',
    });

    expect(tx.branchStock.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { stock: { decrement: 3 } },
    });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1',
        productVariantId: null,
        sourceProductVariantId: null,
        branchId: 'branch-1',
        staffId: 'staff-1',
        type: 'OUT',
        quantity: 3,
        actionQuantity: 3,
        sourceQuantity: 3,
        referenceId: 'order-1',
        referenceType: 'ORDER',
      }),
    });
  });

  it('restores branch stock and records an IN stock transaction', async () => {
    const tx = buildStockTx();
    const service = new OrderInventoryService({ getProducts: jest.fn() } as any);

    await service.restoreProductBranchStock(tx as any, {
      branchId: 'branch-1',
      productId: 'product-1',
      quantity: 2,
      orderId: 'order-1',
      reason: 'Hoàn kho',
      staffId: 'staff-1',
    });

    expect(tx.branchStock.update).toHaveBeenCalledWith({
      where: { id: 'stock-1' },
      data: { stock: { increment: 2 } },
    });
    expect(tx.stockTransaction.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 'product-1',
        productVariantId: null,
        sourceProductVariantId: null,
        branchId: 'branch-1',
        staffId: 'staff-1',
        type: 'IN',
        quantity: 2,
        actionQuantity: 2,
        sourceQuantity: 2,
        referenceId: 'order-1',
        referenceType: 'ORDER',
      }),
    });
  });
});
