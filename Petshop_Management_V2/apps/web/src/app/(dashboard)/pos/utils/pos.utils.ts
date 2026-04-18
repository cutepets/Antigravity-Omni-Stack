/**
 * POS-specific utils — helpers used only by the POS module.
 * Generic cart/payment utils live in app/(dashboard)/_shared/.
 */

import { getProductVariantOptionLabel } from '@petshop/shared'
import type { CartItem } from '@petshop/shared'

// ─── Variant Label ────────────────────────────────────────────────────────────

/**
 * Returns the display label for a variant, or null if it equals the base product
 * name (= single product, no real variant label).
 */
export function getPosVariantLabel(productName: string, variant: any): string | null {
    const explicit = variant?.variantLabel as string | undefined | null
    if (explicit?.trim()) return explicit.trim()
    const label = getProductVariantOptionLabel(productName, variant)
    if (!label) return null
    if (label.trim().toLowerCase() === productName.trim().toLowerCase()) return null
    return label
}

// ─── Cart Item Weight Band ────────────────────────────────────────────────────

export function getCartItemWeightBandLabel(item: CartItem): string | null {
    return (item as any).weightBandLabel ?? (item as any).groomingDetails?.weightBandLabel ?? (item as any).hotelDetails?.chargeWeightBandLabel ?? null
}
