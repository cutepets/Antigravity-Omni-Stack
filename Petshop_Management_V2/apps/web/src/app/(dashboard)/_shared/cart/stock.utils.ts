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

/** A variant-like shape from CartItem.variants. */
type CartVariant = {
    id: string
    conversions?: string | null
    [key: string]: unknown
}

export interface CartItemStockState {
    itemVariants: CartVariant[]
    trueVariants: CartVariant[]
    allConversionVariants: CartVariant[]
    currentVariantObj: CartVariant | undefined
    isCurrentConversion: boolean
    currentTrueVariant: CartVariant | null
    conversionVariants: CartVariant[]
    stockSource: CartVariant | CartItem
    sellableQty: number | null
    isOverSellableQty: boolean
}

export function resolveCartItemStockState(
    item: CartItem & { quantity?: number },
    branchId?: string,
): CartItemStockState {
    const itemVariants: CartVariant[] = (item.variants as CartVariant[] | undefined) ?? []

    const isConversion = (variant: CartVariant) => parseConversionRate(variant?.conversions) !== null

    const trueVariants = itemVariants.filter(v => !isConversion(v))
    const allConversionVariants = itemVariants.filter(isConversion)
    const currentVariantObj = itemVariants.find(v => v.id === item.productVariantId)
    const isCurrentConversion = currentVariantObj ? isConversion(currentVariantObj) : false

    let currentTrueVariant: CartVariant | null = null
    if (currentVariantObj) {
        if (isCurrentConversion) {
            currentTrueVariant = trueVariants.find(
                v => matchesVariantGroup(item.description, v, currentVariantObj),
            ) ?? null
        } else {
            currentTrueVariant = currentVariantObj
        }
    } else if (trueVariants.length === 1) {
        currentTrueVariant = trueVariants[0]
    }

    const conversionVariants = currentTrueVariant
        ? allConversionVariants.filter(v => matchesVariantGroup(item.description, v, currentTrueVariant!))
        : allConversionVariants.filter(v => getEquivalentGroupKeys(item.description, v).has(BASE_GROUP_KEY))

    const stockSource = currentTrueVariant ?? currentVariantObj ?? item

    // branchStocks được lưu ở root cart item, không phải trong từng variant.
    // Nếu stockSource (variant) không có branchStocks, fallback về item-level branchStocks.
    const sourceBranchStocks = Array.isArray((stockSource as CartItem).branchStocks)
        ? (stockSource as CartItem).branchStocks
        : undefined
    const effectiveStockSource =
        sourceBranchStocks && sourceBranchStocks.length > 0
            ? stockSource
            : {
                ...stockSource,
                branchStocks: item.branchStocks,
                availableStock: (stockSource as CartItem).availableStock ?? item.availableStock,
                stock: (stockSource as CartItem).stock ?? item.stock,
                trading: (stockSource as CartItem).trading ?? item.trading,
                reserved: (stockSource as CartItem).reserved ?? item.reserved,
            }

    const sourceSellableQty = getSellableQuantity(effectiveStockSource, branchId)
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
