'use client'

import { Search } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'
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
  return (
    <PageContent className="space-y-4">
      <div className="relative">
        <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted" />
        <input
          type="text"
          value={itemSearch}
          disabled={!isEditing}
          onChange={(event) => onSearchChange(event.target.value)}
          placeholder="Tim san pham, dich vu, grooming, hotel..."
          className="h-12 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
        />
        {isEditing && itemSearch.trim() && (productMatches.length > 0 || serviceMatches.length > 0) ? (
          <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-3xl border border-border bg-background shadow-xl">
            <div className="max-h-[380px] overflow-y-auto p-2">
              {productMatches.length > 0 ? (
                <div className="mb-2">
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
                    San pham
                  </div>
                  {productMatches.map((entry: any) => (
                    <button
                      key={entry.entryId ?? entry.id}
                      type="button"
                      onClick={() => onAddCatalogItem(entry)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-background-secondary"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">
                          {entry.productName ?? entry.name}
                        </div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {[entry.variantLabel, entry.sku].filter(Boolean).join(' • ') || 'Khong co ma SKU'}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary-500">
                        {formatCurrency(Number(entry.sellingPrice ?? entry.price ?? 0))}
                      </div>
                    </button>
                  ))}
                </div>
              ) : null}

              {serviceMatches.length > 0 ? (
                <div>
                  <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
                    Dich vu
                  </div>
                  {serviceMatches.map((entry: any) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => onAddCatalogItem(entry)}
                      className="flex w-full items-center justify-between gap-3 rounded-2xl px-3 py-3 text-left transition-colors hover:bg-background-secondary"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-semibold text-foreground">{entry.name}</div>
                        <div className="mt-1 text-xs text-foreground-muted">
                          {[isHotelService(entry) ? 'Hotel' : isGroomingService(entry) ? 'Grooming' : 'Dich vu', entry.sku]
                            .filter(Boolean)
                            .join(' • ')}
                        </div>
                      </div>
                      <div className="text-sm font-semibold text-primary-500">
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
    </PageContent>
  )
}
