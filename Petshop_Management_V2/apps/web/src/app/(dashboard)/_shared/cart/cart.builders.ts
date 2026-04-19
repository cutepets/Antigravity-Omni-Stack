/**
 * Shared cart builders — used by both POS and Order modules.
 * Factory functions that create CartItem objects from raw API data.
 */

import { buildProductVariantName, type CartItem } from '@petshop/shared'
import {
    isHotelService,
    isGroomingService,
    getOrderServiceId,
    inferSpaPackageCodeFromService,
} from './cart.utils'

// ─── ID Builder ───────────────────────────────────────────────────────────────

export function buildCartLineId(
    type: 'product' | 'service' | 'hotel' | 'grooming',
    ...parts: Array<string | number | null | undefined>
) {
    return [type, ...parts.filter((part) => part !== undefined && part !== null && String(part).trim() !== '')]
        .map((part) => String(part).replace(/\s+/g, '-'))
        .join(':')
}

// ─── Product Builder ─────────────────────────────────────────────────────────

export function buildProductCartItem(product: any): CartItem {
    const variantName = buildProductVariantName(
        product.productName ?? product.name,
        product.variantLabel,
        product.unitLabel,
    )
    return {
        id: buildCartLineId('product', product.productId ?? product.id, product.productVariantId ?? 'base'),
        productId: product.productId ?? product.id,
        productVariantId: product.productVariantId,
        description: product.productName ?? product.name,
        sku: product.sku,
        barcode: product.barcode,
        quantity: 1,
        unitPrice: Number(product.sellingPrice ?? product.price ?? 0),
        discountItem: 0,
        vatRate: 0,
        type: 'product',
        unit: product.unit ?? 'cai',
        image: product.image,
        variantName: variantName || undefined,
        variantLabel: product.variantLabel ?? undefined,
        unitLabel: product.unitLabel ?? undefined,
        variants: product.variants ?? [],
        baseSku: product.sku,
        baseUnitPrice: Number(product.sellingPrice ?? product.price ?? 0),
        // Stock fields for StockBranchPopover
        stock: product.stock,
        availableStock: product.availableStock,
        trading: product.trading,
        reserved: product.reserved,
        branchStocks: product.branchStocks,
    }
}

// ─── Service Builders ─────────────────────────────────────────────────────────

export function buildDirectServiceCartItem(service: any, petId?: string, petName?: string): CartItem {
    const itemType = isHotelService(service) ? 'hotel' : 'service'
    const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)

    return {
        id: buildCartLineId(itemType, service.id, petId),
        serviceId: getOrderServiceId(service),
        description: isHotelService(service)
            ? `Lưu trú${service.weightBandLabel ? ` - ${service.weightBandLabel}` : ''}`
            : service.name,
        sku: service.sku,
        weightBandLabel: service.weightBandLabel,
        unitPrice,
        type: itemType,
        image: service.image,
        unit: itemType === 'hotel' ? 'ngày' : 'lần',
        discountItem: 0,
        vatRate: 0,
        quantity: 1,
        petId,
        petName,
    }
}

export function buildGroomingCartItem(service: any, petId?: string, petName?: string): CartItem {
    const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0)
    const packageCode = service?.packageCode ?? inferSpaPackageCodeFromService(service)
    const petWeight = Number(service?.petSnapshot?.weight ?? Number.NaN)
    const pricingSnapshot =
        service?.pricingSnapshot ??
        (service?.pricingRuleId || service?.weightBandId
            ? {
                pricingRuleId: service?.pricingRuleId,
                packageCode,
                weightBandId: service?.weightBandId ?? null,
                weightBandLabel: service?.weightBandLabel ?? null,
                price: unitPrice,
            }
            : undefined)

    return {
        id: buildCartLineId('grooming', service.id, petId),
        serviceId: getOrderServiceId(service),
        description: service.name,
        sku: service.sku,
        weightBandLabel: service.weightBandLabel,
        unitPrice,
        type: 'grooming',
        image: service.image,
        unit: 'lần',
        discountItem: 0,
        vatRate: 0,
        quantity: 1,
        petId,
        petName,
        groomingDetails: petId
            ? {
                petId,
                packageCode,
                serviceItems: service?.name,
                weightAtBooking: Number.isFinite(petWeight) ? petWeight : undefined,
                weightBandId: service?.weightBandId,
                weightBandLabel: service?.weightBandLabel,
                pricingPrice: unitPrice,
                pricingSnapshot,
            }
            : undefined,
    }
}

// ─── Convenience re-export ────────────────────────────────────────────────────

/** Auto-route to the correct builder based on service type. */
export function buildServiceCartItem(service: any, petId?: string, petName?: string): CartItem {
    if (isGroomingService(service)) return buildGroomingCartItem(service, petId, petName)
    return buildDirectServiceCartItem(service, petId, petName)
}

// ─── Temp Product Builder ─────────────────────────────────────────────────────

/**
 * buildTempCartItem — Tạo CartItem cho sản phẩm tạm (chưa có trong kho).
 * Dùng cho POS "Sản phẩm tạm" và Orders/New khi cần thêm item nhanh.
 */
export function buildTempCartItem(item: {
    description: string
    quantity: number
    unitPrice: number
}): CartItem {
    const id = `temp:${Date.now()}:${Math.random().toString(36).slice(2, 7)}`
    return {
        id,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        discountItem: 0,
        vatRate: 0,
        type: 'product',
        unit: 'cái',
        isTemp: true,
    } as CartItem
}

