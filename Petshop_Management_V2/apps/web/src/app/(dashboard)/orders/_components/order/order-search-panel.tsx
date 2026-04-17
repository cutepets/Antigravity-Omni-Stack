'use client'

import Image from 'next/image'
import { useRef, useState } from 'react'
import { Check, Package, Scissors, Search, X } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { isGroomingService, isHotelService } from './order.utils'

/**
 * Tính số lượng tồn kho có thể bán của 1 item theo branchId (giống POS).
 */
function getSellableQuantity(item: any, branchId?: string): number | null {
  if (!item) return null

  const stockSource = item.branchStocks?.length ? item : item

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

  if (item.availableStock !== undefined && item.availableStock !== null) {
    return Math.max(0, Number(item.availableStock) || 0)
  }
  if (item.stock !== undefined && item.stock !== null) {
    return Math.max(0, Number(item.stock || 0) - Number(item.trading ?? item.reserved ?? 0))
  }
  return null
}

interface OrderSearchPanelProps {
  itemSearch: string
  isEditing: boolean
  productMatches: any[]
  serviceMatches: any[]
  branchId?: string
  cartItems?: any[]
  onSearchChange: (value: string) => void
  onAddCatalogItem: (entry: any) => void
}

export function OrderSearchPanel({
  itemSearch,
  isEditing,
  productMatches,
  serviceMatches,
  branchId,
  cartItems = [],
  onSearchChange,
  onAddCatalogItem,
}: OrderSearchPanelProps) {
  const [isMultiSelect, setIsMultiSelect] = useState(false)
  const [errorId, setErrorId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const hasSuggestions = itemSearch.trim() && (productMatches.length > 0 || serviceMatches.length > 0)

  const getCartQty = (entry: any): number => {
    return cartItems.reduce((total, cartItem) => {
      if (entry.duration !== undefined) {
        return cartItem.serviceId === entry.id ? total + cartItem.quantity : total
      }
      const sameProduct =
        cartItem.productId === (entry.productId ?? entry.id) &&
        (entry.productVariantId
          ? cartItem.productVariantId === entry.productVariantId
          : !cartItem.productVariantId)
      return sameProduct ? total + cartItem.quantity : total
    }, 0)
  }

  const handleSelect = (entry: any) => {
    const entryId = entry.entryId ?? entry.id
    const qty = getCartQty(entry)
    const availableStock = getSellableQuantity(entry, branchId)

    if (availableStock !== null && qty >= availableStock) {
      setErrorId(entryId)
      setTimeout(() => setErrorId(null), 600)
      return
    }

    onAddCatalogItem(entry)

    if (!isMultiSelect) {
      onSearchChange('')
      inputRef.current?.focus()
    }
  }

  const handleClose = () => {
    onSearchChange('')
    setIsMultiSelect(false)
  }

  const allEntries = [
    ...productMatches.map(e => ({ ...e, _section: 'product' })),
    ...serviceMatches.map(e => ({ ...e, _section: 'service' })),
  ]

  return (
    <div className="relative flex-1 max-w-lg">
      {/* Search Input */}
      <div className="relative flex items-center">
        <Search
          size={14}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
        />
        <input
          ref={inputRef}
          type="text"
          value={itemSearch}
          disabled={!isEditing}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Tìm hàng hóa theo tên, mã, barcode... (F1)"
          className="h-9 w-full rounded-lg border border-border bg-background-secondary pl-9 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
        />
        {itemSearch && (
          <button
            type="button"
            onClick={() => onSearchChange('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground-muted hover:text-foreground"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Dropdown */}
      {hasSuggestions && (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          {/* Multi‑select toolbar */}
          <div className="flex items-center justify-between border-b border-border/60 bg-background-secondary/60 px-3 py-2">
            <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
              {allEntries.length} kết quả
            </span>
            <label className="flex cursor-pointer select-none items-center gap-2">
              <span className="text-[12px] font-medium text-foreground-muted">Chọn nhiều</span>
              <div
                role="switch"
                aria-checked={isMultiSelect}
                onClick={() => setIsMultiSelect(!isMultiSelect)}
                className={`relative h-5 w-9 rounded-full transition-colors ${isMultiSelect ? 'bg-primary-500' : 'bg-foreground-muted/30'}`}
              >
                <div
                  className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${isMultiSelect ? 'left-[18px]' : 'left-0.5'}`}
                />
              </div>
            </label>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {productMatches.length > 0 && (
              <div>
                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                  Sản phẩm
                </div>
                <ul>
                  {productMatches.map((entry) => (
                    <SearchResultRow
                      key={entry.entryId ?? entry.id}
                      entry={entry}
                      branchId={branchId}
                      cartQty={getCartQty(entry)}
                      isError={errorId === (entry.entryId ?? entry.id)}
                      isMultiSelect={isMultiSelect}
                      onSelect={handleSelect}
                    />
                  ))}
                </ul>
              </div>
            )}
            {serviceMatches.length > 0 && (
              <div>
                <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-widest text-foreground-muted">
                  Dịch vụ
                </div>
                <ul>
                  {serviceMatches.map((entry) => (
                    <SearchResultRow
                      key={entry.entryId ?? entry.id}
                      entry={entry}
                      branchId={branchId}
                      cartQty={getCartQty(entry)}
                      isError={errorId === (entry.entryId ?? entry.id)}
                      isMultiSelect={isMultiSelect}
                      onSelect={handleSelect}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>

          {/* Multi‑select footer */}
          {isMultiSelect && (
            <div className="flex items-center gap-2 border-t border-border bg-background-secondary/60 p-2.5">
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="flex-1 rounded-lg border border-border py-2 text-sm font-semibold text-foreground-muted hover:bg-background-tertiary"
              >
                Xóa tìm kiếm
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="flex-1 rounded-lg bg-primary-500 py-2 text-sm font-semibold text-white hover:bg-primary-600"
              >
                Xong
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Entry Row ─────────────────────────────────────────────────────────────────

function SearchResultRow({
  entry,
  branchId,
  cartQty,
  isError,
  isMultiSelect,
  onSelect,
}: {
  entry: any
  branchId?: string
  cartQty: number
  isError: boolean
  isMultiSelect: boolean
  onSelect: (entry: any) => void
}) {
  const isService = entry.duration !== undefined || entry.type === 'service'
  const displayName = entry.displayName ?? entry.productName ?? entry.name
  const price = Number(entry.sellingPrice ?? entry.price ?? 0)
  const variantLabel = entry.variantLabel ? entry.variantLabel : null
  const unitLabel = entry.unitLabel ? entry.unitLabel : null
  const availableStock = getSellableQuantity(entry, branchId)
  const outOfStock = availableStock !== null && availableStock <= 0

  let metaLabel: string
  if (isService) {
    const serviceType = isHotelService(entry) ? 'Hotel' : isGroomingService(entry) ? 'Grooming' : 'Dịch vụ'
    metaLabel = [serviceType, entry.sku].filter(Boolean).join(' • ')
  } else {
    metaLabel = [variantLabel, unitLabel, entry.sku].filter(Boolean).join(' • ') || 'Không có mã SKU'
  }

  return (
    <li>
      <button
        type="button"
        onMouseDown={(e) => e.preventDefault()}
        onClick={() => onSelect(entry)}
        className={`flex w-full items-center gap-3 border-b border-border/50 px-3 py-2.5 text-left text-sm transition-colors last:border-0 ${isError
            ? 'bg-destructive/5'
            : outOfStock
              ? 'cursor-not-allowed opacity-50'
              : 'hover:bg-background-secondary'
          }`}
        disabled={outOfStock}
      >
        {/* Image / icon */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-secondary text-foreground-muted">
          {entry.image ? (
            <Image
              src={entry.image}
              alt={displayName}
              className="h-full w-full object-cover"
              width={80}
              height={80}
              unoptimized
            />
          ) : isService ? (
            <Scissors size={16} className="text-accent opacity-60" />
          ) : (
            <Package size={16} className="text-primary-500 opacity-60" />
          )}
          {/* Cart qty badge */}
          {cartQty > 0 && isMultiSelect && (
            <div className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-background text-[10px] font-bold text-white shadow ${isError ? 'bg-destructive' : 'bg-primary-500'}`}>
              {cartQty > 99 ? '99+' : cartQty}
            </div>
          )}
        </div>

        {/* Name + meta */}
        <div className="min-w-0 flex-1">
          <div className={`truncate font-semibold ${isError ? 'text-destructive' : 'text-foreground'}`}>
            {displayName}
            {(variantLabel || unitLabel) && (
              <span className="ml-1.5 text-[11px] font-medium text-primary-500">{[variantLabel, unitLabel].filter(Boolean).join(' • ')}</span>
            )}
          </div>
          <div className="mt-0.5 truncate text-[11px] text-foreground-muted">{metaLabel}</div>
        </div>

        {/* Price + stock */}
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="text-sm font-bold text-foreground">{formatCurrency(price)}</span>
          {availableStock !== null && (
            <span
              className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${outOfStock ? 'bg-destructive/10 text-destructive' : 'bg-success/10 text-success'
                }`}
            >
              {outOfStock ? 'Hết hàng' : `Còn ${availableStock}`}
            </span>
          )}
          {cartQty > 0 && !isMultiSelect && (
            <Check size={14} className="text-primary-500" />
          )}
        </div>
      </button>
    </li>
  )
}
