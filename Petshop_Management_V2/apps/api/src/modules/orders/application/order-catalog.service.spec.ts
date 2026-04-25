import { OrderCatalogService } from './order-catalog.service.js';

describe('OrderCatalogService', () => {
  const buildDb = () => ({
    product: {
      findMany: jest.fn(),
    },
    service: {
      findMany: jest.fn(),
    },
    productSalesDaily: {
      groupBy: jest.fn(),
    },
  });

  it('returns active products enriched with product and variant sales metrics', async () => {
    const db = buildDb();
    db.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Food',
        variants: [{ id: 'variant-1', productId: 'product-1' }],
      },
    ]);
    db.productSalesDaily.groupBy
      .mockResolvedValueOnce([
        {
          productId: 'product-1',
          productVariantId: null,
          _sum: { quantitySold: 3, revenue: 300_000 },
        },
        {
          productId: 'product-1',
          productVariantId: 'variant-1',
          _sum: { quantitySold: 2, revenue: 250_000 },
        },
      ])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const service = new OrderCatalogService(db as any);

    const products = await service.getProducts();

    expect(db.product.findMany).toHaveBeenCalledWith({
      where: { isActive: true, deletedAt: null },
      include: {
        variants: {
          where: { isActive: true, deletedAt: null },
          include: {
            branchStocks: { include: { branch: { select: { name: true } } } },
          },
        },
        branchStocks: { include: { branch: { select: { name: true } } } },
      },
      orderBy: { name: 'asc' },
    });
    expect(products).toHaveLength(1);
    const product = products[0]!;
    expect(product.soldCount).toBe(5);
    expect(product.salesMetrics.totalRevenue).toBe(550_000);
    expect(product.variants).toHaveLength(1);
    const variant = product.variants[0]!;
    expect(variant.soldCount).toBe(2);
    expect(variant.salesMetrics.totalRevenue).toBe(250_000);
  });

  it('returns active services with active variants', async () => {
    const db = buildDb();
    db.service.findMany.mockResolvedValue([{ id: 'service-1' }]);
    const service = new OrderCatalogService(db as any);

    await expect(service.getServices()).resolves.toEqual([{ id: 'service-1' }]);
    expect(db.service.findMany).toHaveBeenCalledWith({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  });
});
