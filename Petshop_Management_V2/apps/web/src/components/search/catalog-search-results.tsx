'use client'
import Image from 'next/image';

import type { ReactNode } from 'react'
import { Package, Scissors } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'


export interface CatalogSearchSection {
  key: string
  label?: string
  entries: any[]
}

export interface CatalogSearchEntryState {
  isSelected?: boolean
  selectedCount?: number
  isError?: boolean
  availableStock?: number | null
  stockLabel?: string
}

interface CatalogSearchResultsProps {
  sections: CatalogSearchSection[]
  query: string
  loading?: boolean
  variant?: 'pos' | 'order'
  showImages?: boolean
  showSectionLabels?: boolean
  loadingText?: string
  emptyText?: ReactNode
  bottomSpacer?: boolean
  onSelect: (entry: any) => void
  getEntryState?: (entry: any) => CatalogSearchEntryState
  getEntryMeta?: (entry: any) => ReactNode
  formatPrice?: (value: number) => string
}

const getEntryKey = (entry: any) => entry.entryId ?? entry.id
const isServiceEntry = (entry: any) => entry.duration !== undefined || entry.type === 'service'

export function CatalogSearchResults({
  sections,
  query,
  loading = false,
  variant = 'order',
  showImages = variant === 'pos',
  showSectionLabels = variant === 'order',
  loadingText = 'Đang tìm kiếm...',
  emptyText,
  bottomSpacer = false,
  onSelect,
  getEntryState,
  getEntryMeta,
  formatPrice = formatCurrency,
}: CatalogSearchResultsProps) {
  const hasEntries = sections.some((section) => section.entries.length > 0)

  if (loading) {
    return <div className="p-6 text-center text-[14px] text-gray-500">{loadingText}</div>
  }

  if (query.length > 0 && !hasEntries) {
    return <div className="p-6 text-center text-[14px] text-gray-500">{emptyText ?? `Không tìm thấy "${query}"`}</div>
  }

  if (!hasEntries) return null

  return (
    <>
      {sections.map((section) =>
        section.entries.length > 0 ? (
          <div key={section.key} className={variant === 'order' ? 'mb-1 last:mb-0' : undefined}>
            {showSectionLabels && section.label ? (
              <div className="px-3 pb-1 pt-2.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                {section.label}
              </div>
            ) : null}
            <ul className="w-full">
              {section.entries.map((entry) => (
                <CatalogSearchResultRow
                  key={getEntryKey(entry)}
                  entry={entry}
                  state={getEntryState?.(entry)}
                  variant={variant}
                  showImage={showImages}
                  onSelect={onSelect}
                  getEntryMeta={getEntryMeta}
                  formatPrice={formatPrice}
                />
              ))}
            </ul>
          </div>
        ) : null,
      )}
      {bottomSpacer ? <div className="h-[80px] w-full lg:hidden" /> : null}
    </>
  )
}

function CatalogSearchResultRow({
  entry,
  state,
  variant,
  showImage,
  onSelect,
  getEntryMeta,
  formatPrice,
}: {
  entry: any
  state?: CatalogSearchEntryState
  variant: 'pos' | 'order'
  showImage: boolean
  onSelect: (entry: any) => void
  getEntryMeta?: (entry: any) => ReactNode
  formatPrice: (value: number) => string
}) {
  const entryKey = getEntryKey(entry)
  const service = isServiceEntry(entry)
  const displayName = entry.displayName ?? entry.productName ?? entry.name
  const price = Number(entry.sellingPrice ?? entry.price ?? 0)
  const finalVariantLabel = entry.variantLabel ? entry.variantLabel : null
  const finalUnitLabel = entry.unitLabel ? entry.unitLabel : null
  const meta = getEntryMeta?.(entry) ?? [finalVariantLabel, finalUnitLabel, entry.sku].filter(Boolean).join(' • ')

  if (variant === 'pos') {
    return (
      <li>
        <button
          type="button"
          className={`group flex w-full items-start gap-4 border-b border-gray-100 bg-white px-4 py-3 text-left transition-all duration-300 last:border-0 ${state?.isError
              ? 'translate-x-2 bg-red-50'
              : state?.isSelected
                ? 'bg-primary-50/20'
                : 'hover:bg-[#f0f9fa]'
            }`}
          onClick={() => onSelect(entry)}
        >
          {showImage ? (
            <div className="relative mt-0.5 flex h-[50px] w-[50px] shrink-0 items-center justify-center overflow-visible rounded-md border border-gray-100 bg-gray-50 text-gray-400 lg:h-[48px] lg:w-[48px]">
              {entry.image ? (
                <Image src={entry.image} alt={entry.name} className="h-[85%] w-[85%] rounded-sm object-cover" width={400} height={400} unoptimized />
              ) : service ? (
                <Scissors size={20} className="text-amber-500/50" />
              ) : (
                <Package size={20} className="text-orange-400/50" />
              )}
              {state?.isSelected && state.selectedCount ? (
                <div className={`absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-sm transition-colors duration-300 ${state.isError ? 'bg-red-500' : 'bg-primary-500'}`}>
                  {state.selectedCount > 99 ? '99+' : state.selectedCount}
                </div>
              ) : null}
            </div>
          ) : null}

          <div className="flex min-w-0 flex-1 flex-col justify-start overflow-hidden pt-0.5">
            <span className={`${state?.isError ? 'font-bold text-red-600' : 'font-medium text-[#333333]'} pr-2 text-[15px] leading-snug transition-colors duration-300 lg:text-[14px]`}>
              {displayName}
              {finalVariantLabel ? (
                <span className="ml-2 text-[12px] font-medium text-[#0089A1]">{finalVariantLabel}</span>
              ) : null}
            </span>
            {entry.sku ? (
              <div className="mt-1">
                <span className="block truncate text-[12px] font-semibold uppercase tracking-wide text-gray-400">
                  {entry.sku}
                </span>
              </div>
            ) : null}
          </div>

          <div className="flex min-w-[70px] shrink-0 flex-col items-end justify-start pt-0.5">
            <span className="text-[15px] font-bold tracking-tight text-[#333333] lg:text-[14px]">{formatPrice(price)}</span>
            {state?.availableStock !== undefined && state.availableStock !== null ? (
              <span
                className={`mt-1 inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors duration-300 ${state.isError || state.availableStock <= 0
                    ? 'bg-red-50 text-red-600'
                    : 'bg-emerald-50 text-emerald-700'
                  }`}
              >
                {state.stockLabel ?? state.availableStock}
              </span>
            ) : null}
          </div>
        </button>
      </li>
    )
  }

  return (
    <li>
      <button
        type="button"
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => onSelect(entry)}
        className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm transition-colors last:border-0 hover:bg-background-secondary"
      >
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium text-foreground">{displayName}</div>
          <div className="mt-0.5 text-[11px] text-foreground-muted">{meta || 'Không có mã SKU'}</div>
        </div>
        <div className="shrink-0 text-sm font-semibold text-primary-500">{formatPrice(price)}</div>
      </button>
    </li>
  )
}
