/**
 * Shared stock utilities — used by both POS and Order modules.
 * Resolves sellable quantity and cart item stock state from API data.
 */

import { getProductVariantGroupKey } from '@petshop/shared'
import type { CartItem } from '@petshop/shared'

// ─── Sellable Quantity ────────────────────────────────────────────────────────

export function getSellableQuantity(stockSource: any, branchId?: string): number | null {
    if (!stockSource) return null

    if (branchId && Array.isArray(stockSource.branchStocks) && stockSource.branchStocks.length > 0) {
        const branchStock = stockSource.branchStocks.find(
            (entry: any) => entry.branchId === branchId || entry.branch?.id === branchId,
        )

        if (!branchStock) return 0

        const available =
            branchStock.availableStock ??
            (branchStock.stock ?? 0) - (branchStock.reservedStock ?? branchStock.reserved ?? 0)

        return Math.max(0, Number(available) || 0)
    }

    if (stockSource.availableStock !== undefined && stockSource.availableStock !== null) {
        return Math.max(0, Number(stockSource.availableStock) || 0)
    }

    if (stockSource.stock !== undefined && stockSource.stock !== null) {
        return Math.max(0, Number(stockSource.stock || 0) - Number(stockSource.trading ?? stockSource.reserved ?? 0))
    }

    return null
}

// ─── Cart Item Stock State ────────────────────────────────────────────────────

export interface CartItemStockState {
    itemVariants: any[]
    trueVariants: any[]
    allConversionVariants: any[]
    currentVariantObj: any
    isCurrentConversion: boolean
    currentTrueVariant: any
    conversionVariants: any[]
    stockSource: any
    sellableQty: number | null
    isOverSellableQty: boolean
}

export function resolveCartItemStockState(
    item: CartItem & { quantity?: number; variants?: any[] },
    branchId?: string,
): CartItemStockState {
    const itemVariants: any[] = (item as any).variants ?? []

    const isConversion = (variant: any) => {
        if (!variant?.conversions) return false
        try {
            const parsed = JSON.parse(variant.conversions)
            return !!(parsed?.rate || parsed?.conversionRate || parsed?.mainQty)
        } catch {
            return false
        }
    }

    const trueVariants = itemVariants.filter((variant: any) => !isConversion(variant))
    const allConversionVariants = itemVariants.filter(isConversion)
    const currentVariantObj = itemVariants.find((variant: any) => variant.id === (item as any).productVariantId)
    const isCurrentConversion = currentVariantObj ? isConversion(currentVariantObj) : false

    let currentTrueVariant: any = null
    if (currentVariantObj) {
        if (isCurrentConversion) {
            const currentGroupKey = getProductVariantGroupKey(item.description, currentVariantObj)
            currentTrueVariant = trueVariants.find(
                (variant: any) => getProductVariantGroupKey(item.description, variant) === currentGroupKey,
            )
        } else {
            currentTrueVariant = currentVariantObj
        }
    }

    const conversionVariants = currentTrueVariant
        ? allConversionVariants.filter(
            (variant: any) =>
                getProductVariantGroupKey(item.description, variant) ===
                getProductVariantGroupKey(item.description, currentTrueVariant),
        )
        : allConversionVariants.filter(
            (variant: any) => getProductVariantGroupKey(item.description, variant) === '__base__',
        )

    const stockSource = currentTrueVariant ?? currentVariantObj ?? item
    const sellableQty = getSellableQuantity(stockSource, branchId)

    return {
        itemVariants,
        trueVariants,
        allConversionVariants,
        currentVariantObj,
        isCurrentConversion,
        currentTrueVariant,
        conversionVariants,
        stockSource,
        sellableQty,
        isOverSellableQty: sellableQty !== null && (item.quantity ?? 1) > sellableQty,
    }
}
