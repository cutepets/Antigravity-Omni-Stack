/**
 * Shared stock utilities — used by both POS and Order modules.
 * Resolves sellable quantity and cart item stock state from API data.
 */

import { getProductVariantGroupKey } from '@petshop/shared'
import type { CartItem } from '@petshop/shared'

const BASE_GROUP_KEY = '__base__'

function parseConversionRate(raw?: string | null) {
    if (!raw) return null
    try {
        const parsed = JSON.parse(raw)
        const rate = Number(parsed?.rate ?? parsed?.conversionRate ?? parsed?.mainQty)
        return Number.isFinite(rate) && rate > 0 ? rate : null
    } catch {
        return null
    }
}

function normalizeGroupKey(value?: string | null) {
    return (
        value
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .trim()
            .toLowerCase() ?? ''
    )
}

function getEquivalentGroupKeys(productName: string | undefined, variant: any) {
    const normalizedProductName = normalizeGroupKey(productName)
    const groupKey = normalizeGroupKey(getProductVariantGroupKey(productName, variant)) || BASE_GROUP_KEY
    const keys = new Set<string>([groupKey])

    if (normalizedProductName) {
        if (groupKey === BASE_GROUP_KEY) {
            keys.add(normalizedProductName)
        }

        if (groupKey === normalizedProductName) {
            keys.add(BASE_GROUP_KEY)
        }
    }

    return keys
}

function matchesVariantGroup(productName: string | undefined, leftVariant: any, rightVariant: any) {
    const leftKeys = getEquivalentGroupKeys(productName, leftVariant)
    const rightKeys = getEquivalentGroupKeys(productName, rightVariant)

    for (const key of leftKeys) {
        if (rightKeys.has(key)) return true
    }

    return false
}

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

    const isConversion = (variant: any) => parseConversionRate(variant?.conversions) !== null

    const trueVariants = itemVariants.filter((variant: any) => !isConversion(variant))
    const allConversionVariants = itemVariants.filter(isConversion)
    const currentVariantObj = itemVariants.find((variant: any) => variant.id === (item as any).productVariantId)
    const isCurrentConversion = currentVariantObj ? isConversion(currentVariantObj) : false

    let currentTrueVariant: any = null
    if (currentVariantObj) {
        if (isCurrentConversion) {
            currentTrueVariant = trueVariants.find(
                (variant: any) => matchesVariantGroup(item.description, variant, currentVariantObj),
            )
        } else {
            currentTrueVariant = currentVariantObj
        }
    } else if (trueVariants.length === 1) {
        currentTrueVariant = trueVariants[0]
    }

    const conversionVariants = currentTrueVariant
        ? allConversionVariants.filter(
            (variant: any) => matchesVariantGroup(item.description, variant, currentTrueVariant),
        )
        : allConversionVariants.filter(
            (variant: any) => getEquivalentGroupKeys(item.description, variant).has(BASE_GROUP_KEY),
        )

    const stockSource = currentTrueVariant ?? currentVariantObj ?? item
    const sourceSellableQty = getSellableQuantity(stockSource, branchId)
    const currentConversionRate = parseConversionRate(currentVariantObj?.conversions)
    const sellableQty =
        isCurrentConversion && currentConversionRate && sourceSellableQty !== null
            ? sourceSellableQty / currentConversionRate
            : sourceSellableQty

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
        isOverSellableQty: sellableQty !== null && (item.quantity ?? 1) > sellableQty + 1e-9,
    }
}
