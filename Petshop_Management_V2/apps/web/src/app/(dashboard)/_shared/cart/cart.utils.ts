/**
 * Shared cart utils — used by both POS and Order modules.
 * Service classification helpers.
 */

// ─── Service Text Helpers ──────────────────────────────────────────────────────

export function normalizeServiceText(value?: string) {
    return (
        value
            ?.normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase() ?? ''
    )
}

// ─── Service Type Classifiers ─────────────────────────────────────────────────

export function isHotelService(service: any) {
    const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
    const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
    return (
        service?.pricingKind === 'HOTEL' ||
        serviceType === 'HOTEL' ||
        service?.suggestionKind === 'HOTEL' ||
        text.includes('hotel') ||
        text.includes('luu chuong')
    )
}

export function isGroomingService(service: any) {
    const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase()
    return (
        service?.pricingKind === 'GROOMING' ||
        serviceType === 'GROOMING' ||
        service?.suggestionKind === 'SPA' ||
        service?.packageCode !== undefined
    )
}

/**
 * Returns true if item is a catalog service (hotel, grooming, or any service entry).
 * Used in POS to route adds to the correct cart builder.
 */
export function isCatalogService(item: any) {
    return (
        isHotelService(item) ||
        isGroomingService(item) ||
        item.serviceId !== undefined ||
        item.serviceVariantId !== undefined ||
        item.pricingKind !== undefined ||
        item.suggestionKind !== undefined ||
        (item.productId === undefined &&
            item.productVariantId === undefined &&
            item.productName === undefined &&
            item.price !== undefined)
    )
}

export function getOrderServiceId(service: any) {
    if (service?.serviceId) return service.serviceId
    return service?.entryType?.startsWith('pricing-') ? undefined : service?.id
}

export function inferSpaPackageCodeFromService(service: any) {
    const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`)
    const hasBath = text.includes('tam')
    const hasClip = text.includes('cao') || text.includes('cat')
    const hasHygiene = text.includes('ve sinh')

    if (text.includes('spa')) return 'SPA'
    if (hasBath && hasClip && hasHygiene) return 'BATH_CLIP_HYGIENE'
    if (hasBath && hasHygiene) return 'BATH_HYGIENE'
    if (hasClip) return 'CLIP'
    if (hasBath) return 'BATH'
    if (hasHygiene) return 'HYGIENE'
    return undefined
}

// ─── Cart Quantity ────────────────────────────────────────────────────────────

export function getCartQuantityStep(item: { type?: string }) {
    return item.type === 'hotel' ? 0.5 : 1
}

export function parseCartQuantityInput(value: string) {
    const normalized = value.replace(/[^\d.,]/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
}
