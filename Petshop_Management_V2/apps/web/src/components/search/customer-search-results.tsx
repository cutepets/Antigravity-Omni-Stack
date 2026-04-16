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

  return (
    <div className={variant === 'pos' ? 'max-h-[300px] overflow-y-auto' : undefined}>
      {showGuest ? (
        <button
          type="button"
          onClick={onSelectGuest}
          className={
            variant === 'pos'
              ? 'flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left transition-colors hover:bg-primary-50'
              : 'flex w-full items-center gap-3 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors hover:bg-background-secondary'
          }
        >
          <div
            className={
              variant === 'pos'
                ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-500'
                : 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500'
            }
          >
            <User size={variant === 'pos' ? 16 : 14} />
          </div>
          <div className="min-w-0">
            <div className={variant === 'pos' ? 'text-sm font-medium text-gray-700' : 'font-medium text-foreground'}>
              {guestLabel}
            </div>
          </div>
        </button>
      ) : null}

      {visibleCustomers.map((customer: any) => (
        <button
          key={customer.id}
          type="button"
          onClick={() => onSelectCustomer(customer)}
          className={
            variant === 'pos'
              ? 'flex w-full items-center gap-3 border-b border-gray-100 p-3 text-left transition-colors last:border-0 hover:bg-primary-50'
              : 'flex w-full items-start justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-background-secondary'
          }
        >
          {variant === 'pos' ? (
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-600">
              <User size={16} />
            </div>
          ) : null}
          <div className="flex min-w-0 flex-col overflow-hidden">
            <span className={variant === 'pos' ? 'truncate text-sm font-medium text-gray-800' : 'truncate font-semibold text-foreground'}>
              {customer.fullName || customer.name}
            </span>
            <span className={variant === 'pos' ? 'text-xs text-gray-500' : 'truncate text-xs text-foreground-muted'}>
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
        <div className={variant === 'pos' ? 'flex flex-col items-start gap-3 border-t border-gray-100 p-4' : 'space-y-3 px-3 py-3'}>
          <div className={variant === 'pos' ? 'text-sm text-gray-500' : 'text-sm text-foreground-muted'}>
            Không tìm thấy khách hàng &quot;{query}&quot;.
          </div>
          <button
            type="button"
            onClick={onQuickAdd}
            className={
              variant === 'pos'
                ? 'flex w-full items-center justify-center gap-1.5 rounded-lg border border-primary-100 bg-primary-50 px-3 py-1.5 text-[15px] font-semibold text-primary-600 transition-colors hover:bg-primary-100 hover:text-primary-700'
                : 'inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary-500/25 bg-primary-500/10 px-3 text-sm font-semibold text-primary-500 transition-colors hover:bg-primary-500/15'
            }
          >
            <Plus size={variant === 'pos' ? 18 : 15} />
            Thêm nhanh &quot;{query}&quot;
          </button>
        </div>
      ) : null}
    </div>
  )
}
