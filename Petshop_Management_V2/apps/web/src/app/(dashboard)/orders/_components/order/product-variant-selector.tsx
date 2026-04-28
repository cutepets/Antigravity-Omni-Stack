'use client'

import Image from 'next/image'
import { X } from 'lucide-react'
import { buildProductVariantName } from '@petshop/shared'
import { formatCurrency } from '@/lib/utils'

interface ProductVariant {
  id: string
  name: string
  displayName?: string | null
  variantLabel?: string | null
  unitLabel?: string | null
  sku?: string | null
  barcode?: string | null
  image?: string | null
  price?: number | null
  sellingPrice?: number | null
  stock?: number | null
  availableStock?: number | null
}

interface ProductVariantSelectorProps {
  isOpen: boolean
  productName: string
  variants: ProductVariant[]
  onSelect: (variant: ProductVariant) => void
  onClose: () => void
}

export function ProductVariantSelector({
  isOpen,
  productName,
  variants,
  onSelect,
  onClose,
}: ProductVariantSelectorProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 app-modal-overlay" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border bg-background shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-foreground">Ch?n phi?n b?n</h3>
            <p className="mt-0.5 text-sm text-foreground-muted">{productName}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="max-h-96 overflow-y-auto p-2">
          {variants.map((variant) => {
            const displayName =
              variant.displayName ??
              buildProductVariantName(productName, variant.variantLabel, variant.unitLabel) ??
              variant.name
            const metaLabel = [variant.variantLabel, variant.unitLabel, variant.sku || 'Kh?ng c? m? SKU']
              .filter(Boolean)
              .join(' ? ')

            return (
              <button
                key={variant.id}
                type="button"
                onClick={() => onSelect(variant)}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-background-secondary"
              >
                {variant.image ? (
                  <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg border border-border">
                    <Image
                      src={variant.image}
                      alt={displayName}
                      className="h-full w-full object-cover"
                      width={400}
                      height={400}
                      unoptimized
                    />
                  </div>
                ) : (
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-border bg-background-secondary">
                    <span className="text-xs font-medium text-foreground-muted">?nh</span>
                  </div>
                )}

                <div className="min-w-0 flex-1">
                  <div className="truncate font-medium text-foreground">{displayName}</div>
                  <div className="mt-0.5 text-xs text-foreground-muted">{metaLabel}</div>
                </div>

                <div className="shrink-0 text-right">
                  <div className="font-semibold text-primary-500">
                    {formatCurrency(Number(variant.sellingPrice ?? variant.price ?? 0))}
                  </div>
                  {variant.availableStock !== undefined && variant.availableStock !== null && (
                    <div
                      className={`mt-0.5 text-xs ${
                        variant.availableStock > 0 ? 'text-emerald-600' : 'text-red-500'
                      }`}
                    >
                      {variant.availableStock > 0 ? `C?n ${variant.availableStock}` : 'H?t h?ng'}
                    </div>
                  )}
                </div>
              </button>
            )
          })}
        </div>

        <div className="border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-xl border border-border bg-background-secondary py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
          >
            Há»§y
          </button>
        </div>
      </div>
    </div>
  )
}
