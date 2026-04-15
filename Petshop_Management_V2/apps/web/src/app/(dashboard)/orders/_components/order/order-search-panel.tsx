'use client'

import { Search } from 'lucide-react'
import { CatalogSearchResults } from '@/components/search/catalog-search-results'
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
            <CatalogSearchResults
              sections={[
                { key: 'products', label: 'Sản phẩm', entries: productMatches },
                { key: 'services', label: 'Dịch vụ', entries: serviceMatches },
              ]}
              query={itemSearch}
              variant="order"
              onSelect={onAddCatalogItem}
              getEntryMeta={(entry) => {
                if (entry.duration === undefined) {
                  return [entry.variantLabel, entry.sku].filter(Boolean).join(' • ') || 'Không có mã SKU'
                }

                return [
                  isHotelService(entry)
                    ? 'Hotel'
                    : isGroomingService(entry)
                      ? 'Grooming'
                      : 'Dịch vụ',
                  entry.sku,
                ]
                  .filter(Boolean)
                  .join(' • ')
              }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
