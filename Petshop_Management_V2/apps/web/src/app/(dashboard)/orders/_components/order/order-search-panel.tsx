'use client'

import { Search } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { isGroomingService, isHotelService } from './order.utils'

interface OrderSearchPanelProps {
  itemSearch: string
  isEditing: boolean
  productMatches: any[]
  serviceMatches: any[]
  onSearchChange: (value: string) => void
  onAddCatalogItem: (entry: any) => void
}

export function OrderSearchPanel({
  itemSearch,
  isEditing,
  productMatches,
  serviceMatches,
  onSearchChange,
  onAddCatalogItem,
}: OrderSearchPanelProps) {
  const hasSuggestions = itemSearch.trim() && (productMatches.length > 0 || serviceMatches.length > 0)

  return (
    <div className="relative flex-1 max-w-lg">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
      />
      <input
        type="text"
        value={itemSearch}
        disabled={!isEditing}
        onChange={(event) => onSearchChange(event.target.value)}
        placeholder="Tìm hàng hóa theo tên, mã, barcode..."
        className="h-9 w-full rounded-lg border border-border bg-background-secondary pl-9 pr-4 text-sm text-foreground outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:opacity-60"
      />

      {hasSuggestions ? (
        <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
          <div className="max-h-72 overflow-y-auto custom-scrollbar">
            {productMatches.length > 0 ? (
              <div className="mb-1">
                <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Sản phẩm
                </div>
                {productMatches.map((entry: any) => (
                  <button
                    key={entry.entryId ?? entry.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAddCatalogItem(entry)}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 transition-colors hover:bg-background-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">
                        {entry.productName ?? entry.name}
                      </div>
                      <div className="text-[11px] text-foreground-muted mt-0.5">
                        {[entry.variantLabel, entry.sku].filter(Boolean).join(' • ') || 'Không có mã SKU'}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-primary-500">
                      {formatCurrency(Number(entry.sellingPrice ?? entry.price ?? 0))}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}

            {serviceMatches.length > 0 ? (
              <div>
                <div className="px-3 pt-2.5 pb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Dịch vụ
                </div>
                {serviceMatches.map((entry: any) => (
                  <button
                    key={entry.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => onAddCatalogItem(entry)}
                    className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 transition-colors hover:bg-background-secondary"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{entry.name}</div>
                      <div className="text-[11px] text-foreground-muted mt-0.5">
                        {[
                          isHotelService(entry)
                            ? 'Hotel'
                            : isGroomingService(entry)
                              ? 'Grooming'
                              : 'Dịch vụ',
                          entry.sku,
                        ]
                          .filter(Boolean)
                          .join(' • ')}
                      </div>
                    </div>
                    <div className="shrink-0 text-sm font-semibold text-primary-500">
                      {formatCurrency(Number(entry.sellingPrice ?? entry.price ?? 0))}
                    </div>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  )
}
