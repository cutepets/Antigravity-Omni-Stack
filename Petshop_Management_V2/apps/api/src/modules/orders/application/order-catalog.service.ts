import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';

type SalesMetrics = ReturnType<OrderCatalogService['createEmptySalesMetrics']>;

@Injectable()
export class OrderCatalogService {
  constructor(private readonly prisma: DatabaseService) {}

  private createEmptySalesMetrics() {
    return {
      totalQuantitySold: 0,
      totalRevenue: 0,
      weekQuantitySold: 0,
      weekRevenue: 0,
      monthQuantitySold: 0,
      monthRevenue: 0,
      yearQuantitySold: 0,
      yearRevenue: 0,
    };
  }

  private async loadProductSalesMetrics(productIds: string[]) {
    const uniqueProductIds = [...new Set(productIds.filter(Boolean))];
    if (uniqueProductIds.length === 0) {
      return {
        byProductId: new Map<string, SalesMetrics>(),
        byVariantId: new Map<string, SalesMetrics>(),
      };
    }

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday);
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const whereBase = { productId: { in: uniqueProductIds } };

    const [totalRows, weekRows, monthRows, yearRows] = await Promise.all([
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: whereBase,
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfWeek },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfMonth },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
      this.prisma.productSalesDaily.groupBy({
        by: ['productId', 'productVariantId'],
        where: {
          ...whereBase,
          date: { gte: startOfYear },
        },
        _sum: { quantitySold: true, revenue: true },
      }),
    ]);

    const byProductId = new Map<string, SalesMetrics>();
    const byVariantId = new Map<string, SalesMetrics>();

    const mergeRows = (
      rows: Array<{
        productId: string | null;
        productVariantId: string | null;
        _sum: { quantitySold: number | null; revenue: number | null };
      }>,
      quantityKey: 'totalQuantitySold' | 'weekQuantitySold' | 'monthQuantitySold' | 'yearQuantitySold',
      revenueKey: 'totalRevenue' | 'weekRevenue' | 'monthRevenue' | 'yearRevenue',
    ) => {
      for (const row of rows) {
        if (!row.productId) continue;

        const productMetrics = byProductId.get(row.productId) ?? this.createEmptySalesMetrics();
        productMetrics[quantityKey] += row._sum.quantitySold ?? 0;
        productMetrics[revenueKey] += row._sum.revenue ?? 0;
        byProductId.set(row.productId, productMetrics);

        if (!row.productVariantId) continue;

        const variantMetrics = byVariantId.get(row.productVariantId) ?? this.createEmptySalesMetrics();
        variantMetrics[quantityKey] += row._sum.quantitySold ?? 0;
        variantMetrics[revenueKey] += row._sum.revenue ?? 0;
        byVariantId.set(row.productVariantId, variantMetrics);
      }
    };

    mergeRows(totalRows as any, 'totalQuantitySold', 'totalRevenue');
    mergeRows(weekRows as any, 'weekQuantitySold', 'weekRevenue');
    mergeRows(monthRows as any, 'monthQuantitySold', 'monthRevenue');
    mergeRows(yearRows as any, 'yearQuantitySold', 'yearRevenue');

    return { byProductId, byVariantId };
  }

  async getProducts() {
    const products = await this.prisma.product.findMany({
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

    const { byProductId, byVariantId } = await this.loadProductSalesMetrics(products.map((product) => product.id));

    return products.map((product) => {
      const productMetrics = byProductId.get(product.id) ?? this.createEmptySalesMetrics();

      return {
        ...product,
        soldCount: productMetrics.totalQuantitySold,
        salesMetrics: productMetrics,
        variants: product.variants.map((variant) => {
          const variantMetrics = byVariantId.get(variant.id) ?? this.createEmptySalesMetrics();

          return {
            ...variant,
            soldCount: variantMetrics.totalQuantitySold,
            salesMetrics: variantMetrics,
          };
        }),
      };
    });
  }

  async getServices() {
    return this.prisma.service.findMany({
      where: { isActive: true },
      include: { variants: { where: { isActive: true } } },
      orderBy: { name: 'asc' },
    });
  }
}
