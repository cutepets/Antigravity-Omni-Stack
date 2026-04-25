import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../../database/database.service.js';
import { resolveBranchIdentity } from '../../../common/utils/branch-identity.util.js';
import { resolveInventoryLedgerMovement } from '../../../common/utils/inventory-ledger.util.js';
import { OrderCatalogService } from './order-catalog.service.js';

@Injectable()
export class OrderInventoryService {
  constructor(private readonly catalog: OrderCatalogService) {}

  getProducts() {
    return this.catalog.getProducts();
  }

  private getCompletedSalesBucket(date: Date): Date {
    const bucket = new Date(date);
    bucket.setHours(0, 0, 0, 0);
    return bucket;
  }

  private getCompletedSalesBranchScope(branchId?: string | null): string {
    return branchId ?? 'UNASSIGNED';
  }

  private getCompletedSalesKey(productId: string, productVariantId?: string | null): string {
    return productVariantId ? `variant:${productVariantId}` : `product:${productId}`;
  }

  async applyCompletedProductSalesDelta(
    tx: Pick<DatabaseService, 'productSalesDaily'>,
    params: {
      completedAt: Date;
      branchId?: string | null;
      items: Array<{
        productId?: string | null;
        productVariantId?: string | null;
        quantity: number;
        subtotal: number;
      }>;
      multiplier?: 1 | -1;
    },
  ) {
    const multiplier = params.multiplier ?? 1;
    const date = this.getCompletedSalesBucket(params.completedAt);
    const branchScope = this.getCompletedSalesBranchScope(params.branchId);
    const grouped = new Map<
      string,
      {
        productId: string;
        productVariantId: string | null;
        quantitySold: number;
        revenue: number;
      }
    >();

    for (const item of params.items) {
      if (!item.productId) continue;

      const salesKey = this.getCompletedSalesKey(item.productId, item.productVariantId ?? null);
      const current = grouped.get(salesKey) ?? {
        productId: item.productId,
        productVariantId: item.productVariantId ?? null,
        quantitySold: 0,
        revenue: 0,
      };

      current.quantitySold += item.quantity * multiplier;
      current.revenue += item.subtotal * multiplier;
      grouped.set(salesKey, current);
    }

    for (const [salesKey, value] of grouped.entries()) {
      if (value.quantitySold === 0 && value.revenue === 0) continue;

      await tx.productSalesDaily.upsert({
        where: {
          date_branchScope_salesKey: {
            date,
            branchScope,
            salesKey,
          },
        },
        create: {
          date,
          branchId: params.branchId ?? null,
          branchScope,
          productId: value.productId,
          productVariantId: value.productVariantId,
          salesKey,
          quantitySold: value.quantitySold,
          revenue: value.revenue,
        },
        update: {
          branchId: params.branchId ?? null,
          productId: value.productId,
          productVariantId: value.productVariantId,
          quantitySold: { increment: value.quantitySold },
          revenue: { increment: value.revenue },
        },
      });
    }
  }

  async restoreProductBranchStock(
    tx: DatabaseService,
    params: {
      branchId?: string | null;
      productId: string;
      productVariantId?: string | null;
      quantity: number;
      orderId: string;
      reason: string;
      staffId?: string | null;
    },
  ) {
    const movement = await resolveInventoryLedgerMovement(tx, {
      productId: params.productId,
      productVariantId: params.productVariantId,
      quantity: params.quantity,
      quantityLabel: 'So luong hoan ton',
    });
    const effectiveVariantId = movement.sourceVariantId;
    const effectiveQuantity = movement.sourceQuantity;

    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    let branchStock = await tx.branchStock.findFirst({
      where: {
        branchId: branch.id,
        productId: params.productId,
        productVariantId: effectiveVariantId,
      },
    });

    if (!branchStock && effectiveVariantId !== null) {
      branchStock = await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: null,
        },
      });
    }

    if (!branchStock && effectiveVariantId === null) {
      branchStock = await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
        },
      });
    }

    if (branchStock) {
      await tx.branchStock.update({
        where: { id: branchStock.id },
        data: {
          stock: { increment: effectiveQuantity },
        },
      });
    } else {
      await tx.branchStock.create({
        data: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: effectiveVariantId,
          stock: Math.max(0, effectiveQuantity),
          reservedStock: 0,
          minStock: 5,
        } as any,
      });
    }

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: movement.actionVariantId,
        sourceProductVariantId: movement.sourceVariantId,
        branchId: branch.id ?? null,
        staffId: params.staffId ?? null,
        type: 'IN',
        quantity: Math.abs(movement.sourceQuantity),
        actionQuantity: movement.actionQuantity,
        sourceQuantity: movement.sourceQuantity,
        conversionRate: movement.conversionRate,
        reason: params.reason,
        referenceId: params.orderId,
        referenceType: 'ORDER',
      } as any,
    });
  }

  async deductProductBranchStock(
    tx: DatabaseService,
    params: {
      branchId?: string | null;
      productId: string;
      productVariantId?: string | null;
      quantity: number;
      orderId: string;
      reason: string;
      staffId?: string | null;
    },
  ) {
    const movement = await resolveInventoryLedgerMovement(tx, {
      productId: params.productId,
      productVariantId: params.productVariantId,
      quantity: params.quantity,
      quantityLabel: 'So luong xuat ton',
    });
    const effectiveVariantId = movement.sourceVariantId;
    const effectiveQuantity = movement.sourceQuantity;

    const branch = await resolveBranchIdentity(tx as any, params.branchId ?? null);
    const productDisplayLabel = effectiveVariantId
      ? await tx.productVariant
          .findUnique({
            where: { id: effectiveVariantId },
            select: {
              name: true,
              sku: true,
              product: {
                select: {
                  name: true,
                },
              },
            },
          })
          .then((variant) => {
            const productName = variant?.product?.name || variant?.name || params.productId;
            return variant?.sku ? `${productName} (${variant.sku})` : productName;
          })
      : await tx.product
          .findUnique({
            where: { id: params.productId },
            select: {
              name: true,
              sku: true,
            },
          })
          .then((product) => {
            const productName = product?.name || params.productId;
            return product?.sku ? `${productName} (${product.sku})` : productName;
          });
    let branchStock = await tx.branchStock.findFirst({
      where: {
        branchId: branch.id,
        productId: params.productId,
        productVariantId: effectiveVariantId,
      },
    });

    if (!branchStock && effectiveVariantId !== null) {
      branchStock = await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
          productVariantId: null,
        },
      });
    }

    if (!branchStock && effectiveVariantId === null) {
      branchStock = await tx.branchStock.findFirst({
        where: {
          branchId: branch.id,
          productId: params.productId,
        },
      });
    }

    if (!branchStock) {
      throw new BadRequestException(`San pham ${productDisplayLabel} chua co ton kho tai chi nhanh ${branch.name}`);
    }

    if (branchStock.stock < effectiveQuantity) {
      throw new BadRequestException(
        `Ton kho khong du cho san pham ${productDisplayLabel} tai chi nhanh ${branch.name}. Con ${branchStock.stock}, can ${effectiveQuantity} (${params.quantity} x ${movement.conversionRate ?? 1}).`,
      );
    }

    await tx.branchStock.update({
      where: { id: branchStock.id },
      data: {
        stock: { decrement: effectiveQuantity },
      },
    });

    await tx.stockTransaction.create({
      data: {
        productId: params.productId,
        productVariantId: movement.actionVariantId,
        sourceProductVariantId: movement.sourceVariantId,
        branchId: branch.id ?? null,
        staffId: params.staffId ?? null,
        type: 'OUT',
        quantity: Math.abs(movement.sourceQuantity),
        actionQuantity: movement.actionQuantity,
        sourceQuantity: movement.sourceQuantity,
        conversionRate: movement.conversionRate,
        reason: params.reason,
        referenceId: params.orderId,
        referenceType: 'ORDER',
      } as any,
    });
  }
}
