import { BadRequestException } from '@nestjs/common'
import {
  getProductVariantGroupKey,
  isConversionVariant,
  parseConversionRate,
} from '@petshop/shared'

type ProductVariantLike = {
  id: string
  productId?: string | null
  name?: string | null
  variantLabel?: string | null
  unitLabel?: string | null
  sku?: string | null
  conversions?: string | null
  isActive?: boolean | null
  deletedAt?: Date | string | null
}

type ProductLike = {
  id: string
  name?: string | null
  sku?: string | null
  variants?: ProductVariantLike[] | null
}

type InventoryLedgerTx = {
  product: {
    findUnique(args: any): Promise<ProductLike | null>
  }
}

export type InventoryLedgerMovement = {
  productId: string
  actionVariantId: string | null
  sourceVariantId: string | null
  actionQuantity: number
  sourceQuantity: number
  conversionRate: number | null
}

function assertFiniteQuantity(quantity: number) {
  if (!Number.isFinite(quantity) || quantity === 0) {
    throw new BadRequestException('So luong ton kho khong hop le')
  }
}

function toInventoryIntegerQuantity(value: number, context: string) {
  const rounded = Math.round(value)
  if (Math.abs(value - rounded) > 1e-9) {
    throw new BadRequestException(`${context} phai quy doi ra so nguyen theo don vi goc`)
  }
  return rounded
}

function isActiveVariant(variant: ProductVariantLike) {
  return !variant.deletedAt && variant.isActive !== false
}

function getEquivalentVariantGroupKeys(productName?: string | null, variant?: ProductVariantLike | null) {
  const groupKey = getProductVariantGroupKey(productName, variant)
  const normalizedProductKey = `${productName ?? ''}`.trim().toLowerCase()
  const keys = new Set<string>([groupKey])

  if (!normalizedProductKey) {
    return keys
  }

  if (groupKey === '__base__') {
    keys.add(normalizedProductKey)
  } else if (groupKey === normalizedProductKey) {
    keys.add('__base__')
  }

  return keys
}

export function findSourceVariantForAction(
  product: ProductLike,
  actionVariant?: ProductVariantLike | null,
) {
  if (!actionVariant) return null
  if (!isConversionVariant(actionVariant)) return actionVariant

  const variants = (product.variants ?? []).filter(isActiveVariant)
  const candidateGroupKeys = getEquivalentVariantGroupKeys(product.name, actionVariant)
  const sourceVariants = variants.filter(
    (variant) =>
      variant.id !== actionVariant.id &&
      !isConversionVariant(variant) &&
      candidateGroupKeys.has(getProductVariantGroupKey(product.name, variant)),
  )

  if (sourceVariants.length === 1) {
    return sourceVariants[0]
  }

  if (candidateGroupKeys.has('__base__') && sourceVariants.length === 0) {
    return null
  }

  const skuLabel = actionVariant.sku ? ` (${actionVariant.sku})` : ''
  throw new BadRequestException(
    sourceVariants.length === 0
      ? `SKU quy doi ${actionVariant.name ?? actionVariant.id}${skuLabel} chua co SKU goc cung nhom`
      : `SKU quy doi ${actionVariant.name ?? actionVariant.id}${skuLabel} co nhieu SKU goc cung nhom`,
  )
}

export async function resolveInventoryLedgerMovement(
  tx: InventoryLedgerTx,
  params: {
    productId: string
    productVariantId?: string | null
    quantity: number
    quantityLabel?: string
  },
): Promise<InventoryLedgerMovement> {
  assertFiniteQuantity(params.quantity)

  const product = await tx.product.findUnique({
    where: { id: params.productId },
    select: {
      id: true,
      name: true,
      sku: true,
      variants: {
        select: {
          id: true,
          productId: true,
          name: true,
          variantLabel: true,
          unitLabel: true,
          sku: true,
          conversions: true,
          isActive: true,
          deletedAt: true,
        },
      },
    },
  })

  if (!product) {
    throw new BadRequestException('Khong tim thay san pham de quy doi ton kho')
  }

  const actionVariantId = params.productVariantId?.trim() || null
  const actionVariant = actionVariantId
    ? (product.variants ?? []).find((variant) => variant.id === actionVariantId) ?? null
    : null

  if (actionVariantId && !actionVariant) {
    throw new BadRequestException('SKU thao tac khong thuoc san pham nay')
  }

  if (actionVariant && !isActiveVariant(actionVariant)) {
    throw new BadRequestException('SKU thao tac da ngung hoat dong hoac da bi xoa')
  }

  if (!actionVariant) {
    return {
      productId: product.id,
      actionVariantId: null,
      sourceVariantId: null,
      actionQuantity: params.quantity,
      sourceQuantity: toInventoryIntegerQuantity(params.quantity, params.quantityLabel ?? 'So luong'),
      conversionRate: null,
    }
  }

  if (!isConversionVariant(actionVariant)) {
    return {
      productId: product.id,
      actionVariantId,
      sourceVariantId: actionVariant.id,
      actionQuantity: params.quantity,
      sourceQuantity: toInventoryIntegerQuantity(params.quantity, params.quantityLabel ?? 'So luong'),
      conversionRate: null,
    }
  }

  const conversionRate = parseConversionRate(actionVariant.conversions) ?? 1
  const sourceVariant = findSourceVariantForAction(product, actionVariant)
  const sourceQuantityRaw = params.quantity * conversionRate

  return {
    productId: product.id,
    actionVariantId,
    sourceVariantId: sourceVariant?.id ?? null,
    actionQuantity: params.quantity,
    sourceQuantity: toInventoryIntegerQuantity(sourceQuantityRaw, params.quantityLabel ?? 'So luong quy doi'),
    conversionRate,
  }
}

export function getInventorySourceKey(productId: string, sourceVariantId?: string | null) {
  return sourceVariantId ? `variant:${sourceVariantId}` : `product:${productId}`
}
