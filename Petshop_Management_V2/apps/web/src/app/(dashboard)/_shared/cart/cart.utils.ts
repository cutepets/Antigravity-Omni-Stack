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

export function parseCartQuantityInput(value: string) {
    const normalized = value.replace(/[^\d.,]/g, '').replace(',', '.')
    const parsed = Number(normalized)
    return Number.isFinite(parsed) ? parsed : Number.NaN
}

export function getServiceSpeciesLabel(service: any) {
    const rawSpecies =
        service?.species ??
        service?.petSnapshot?.species ??
        service?.pricingSnapshot?.species ??
        service?.weightBand?.species ??
        service?.weightBandSpecies
    const normalized = normalizeServiceText(String(rawSpecies ?? '').trim())

    if (!normalized) return undefined
    if (['cho', 'dog', 'canine'].includes(normalized)) return 'Chó'
    if (['meo', 'cat', 'feline'].includes(normalized)) return 'Mèo'
    return String(rawSpecies).trim()
}

export function appendSpeciesToServiceName(name?: string | null, service?: any) {
    const baseName = String(name ?? '').trim()
    const speciesLabel = getServiceSpeciesLabel(service)

    if (!baseName || !speciesLabel) return baseName
    if (normalizeServiceText(baseName).endsWith(`- ${normalizeServiceText(speciesLabel)}`)) return baseName
    return `${baseName} - ${speciesLabel}`
}

export function resolveCartUnitLabel(item: { type?: string; unit?: string | null }) {
    if (item.type === 'hotel') return 'Ngày'
    if (item.type === 'service' || item.type === 'grooming') return 'Lần'
    return item.unit
}

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

function getCurrentCartVariant(item: { productVariantId?: string; variants?: any[]; conversions?: string | null }) {
    if (item.productVariantId && Array.isArray(item.variants)) {
        const directVariant = item.variants.find((variant: any) => variant?.id === item.productVariantId)
        if (directVariant) return directVariant

        for (const variant of item.variants) {
            const childVariant = variant?.children?.find?.((entry: any) => entry?.id === item.productVariantId)
            if (childVariant) return childVariant
        }
    }

    return item
}

export function isConversionCartItem(item: {
    productVariantId?: string
    variants?: any[]
    conversions?: string | null
}) {
    return parseConversionRate(getCurrentCartVariant(item)?.conversions) !== null
}

function getStepPrecision(step: number) {
    if (!Number.isFinite(step) || step >= 1) return 0
    const [, decimals = ''] = step.toString().split('.')
    return decimals.length
}

export function roundCartQuantity(value: number, step: number) {
    const safeStep = Number.isFinite(step) && step > 0 ? step : 1
    const precision = Math.max(3, getStepPrecision(safeStep))
    return Number((Math.round(value / safeStep) * safeStep).toFixed(precision))
}

export function formatCartQuantityInput(value: number, step: number) {
    if (!Number.isFinite(value)) return ''

    const precision = Math.max(getStepPrecision(step), Number.isInteger(value) ? 0 : 1)
    return value.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: Math.max(3, precision),
        useGrouping: false,
    })
}

export function getCartQuantityStep(item: {
    type?: string
    productVariantId?: string
    variants?: any[]
    conversions?: string | null
}) {
    if (item.type === 'hotel') return 0.5
    if (isConversionCartItem(item)) return 0.1
    return 1
}
