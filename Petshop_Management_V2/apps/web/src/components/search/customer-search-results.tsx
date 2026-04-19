'use client'

import { Plus, User } from 'lucide-react'

interface CustomerSearchResultsProps {
  customers: any[]
  query: string
  variant?: 'pos' | 'order'
  maxResults?: number
  showGuest?: boolean
  guestLabel?: string
  onSelectGuest?: () => void
  onSelectCustomer: (customer: any) => void
  onQuickAdd?: () => void
}

export function CustomerSearchResults({
  customers,
  query,
  variant = 'order',
  maxResults,
  showGuest = true,
  guestLabel = 'Khách lẻ',
  onSelectGuest,
  onSelectCustomer,
  onQuickAdd,
}: CustomerSearchResultsProps) {
  const visibleCustomers = maxResults ? customers.slice(0, maxResults) : customers
  const hasEmptySearch = query.trim().length > 0 && customers.length === 0

  // Single theme-aware row class — CSS vars adapt to light/dark automatically
  const rowCls =
    variant === 'pos'
      ? 'flex w-full items-center gap-3 border-b border-border/50 p-3 text-left transition-colors hover:bg-background-secondary last:border-0'
      : 'flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-background-secondary'

  return (
    <div className={variant === 'pos' ? 'max-h-[300px] overflow-y-auto' : undefined}>
      {showGuest ? (
        <button type="button" onClick={onSelectGuest} className={rowCls}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
            <User size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{guestLabel}</div>
          </div>
        </button>
      ) : null}

      {visibleCustomers.map((customer: any) => (
        <button key={customer.id} type="button" onClick={() => onSelectCustomer(customer)} className={rowCls}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
            <User size={16} />
          </div>
          <div className="flex min-w-0 flex-col overflow-hidden">
            <span className="truncate text-sm font-semibold text-foreground">
              {customer.fullName || customer.name}
            </span>
            <span className="truncate text-xs text-foreground-muted">
              {customer.phone || 'Chưa có SĐT'}
            </span>
            {variant === 'order' ? (
              <span className="truncate text-xs text-foreground-muted">{customer.address || 'Chưa có địa chỉ'}</span>
            ) : null}
          </div>
          {variant === 'order' ? <User size={14} className="mt-0.5 shrink-0 text-foreground-muted" /> : null}
        </button>
      ))}

      {hasEmptySearch && onQuickAdd ? (
        <div className="space-y-3 px-3 py-3">
          <div className="text-sm text-foreground-muted">
            Không tìm thấy khách hàng &quot;{query}&quot;.
          </div>
          <button
            type="button"
            onClick={onQuickAdd}
            className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary-500/25 bg-primary-500/10 px-3 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/15"
          >
            <Plus size={15} />
            Thêm nhanh &quot;{query}&quot;
          </button>
        </div>
      ) : null}
    </div>
  )
}
