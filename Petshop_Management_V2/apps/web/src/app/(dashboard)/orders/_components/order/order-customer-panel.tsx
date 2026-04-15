'use client'

import { Search, User, XCircle } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'

interface OrderCustomerPanelProps {
  branches: any[]
  draft: any
  isEditing: boolean
  customerSearch: string
  customerResults: any[]
  onBranchChange: (branchId?: string) => void
  onCustomerSearchChange: (value: string) => void
  onSelectCustomer: (customer: any) => void
  onClearCustomer: () => void
  onCustomerNameChange: (value: string) => void
  onDiscountChange: (value: string) => void
  onShippingFeeChange: (value: string) => void
  onNotesChange: (value: string) => void
}

export function OrderCustomerPanel({
  branches,
  draft,
  isEditing,
  customerSearch,
  customerResults,
  onBranchChange,
  onCustomerSearchChange,
  onSelectCustomer,
  onClearCustomer,
  onCustomerNameChange,
  onDiscountChange,
  onShippingFeeChange,
  onNotesChange,
}: OrderCustomerPanelProps) {
  return (
    <PageContent className="space-y-6">
      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Chi nhanh
          </span>
          <select
            value={draft.branchId ?? ''}
            disabled={!isEditing}
            onChange={(event) => onBranchChange(event.target.value || undefined)}
            className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
          >
            <option value="">Chon chi nhanh</option>
            {branches.map((branch: any) => (
              <option key={branch.id} value={branch.id}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>

        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Khach hang
          </span>
          {draft.customerId ? (
            <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="text-sm font-semibold text-foreground">{draft.customerName || 'Khach le'}</div>
                  <div className="mt-1 text-xs text-foreground-muted">Khach da duoc gan cho don hang.</div>
                </div>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-border bg-background text-foreground-muted transition-colors hover:text-error"
                  >
                    <XCircle size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <Search
                  size={16}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                />
                <input
                  type="text"
                  value={customerSearch}
                  disabled={!isEditing}
                  onChange={(event) => onCustomerSearchChange(event.target.value)}
                  placeholder="Tim khach theo ten hoac so dien thoai"
                  className="h-11 w-full rounded-2xl border border-border bg-background pl-10 pr-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                />
                {isEditing && customerSearch.trim().length >= 2 && customerResults.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+8px)] z-20 rounded-2xl border border-border bg-background shadow-xl">
                    {customerResults.slice(0, 6).map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => onSelectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-background-secondary"
                      >
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {customer.fullName || customer.name}
                          </div>
                          <div className="mt-1 text-xs text-foreground-muted">
                            {customer.phone || 'Khong co SDT'}
                          </div>
                        </div>
                        <User size={16} className="text-foreground-muted" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>

              <input
                type="text"
                value={draft.customerName}
                disabled={!isEditing}
                onChange={(event) => onCustomerNameChange(event.target.value)}
                placeholder="Ten hien thi neu la khach le"
                className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
              />
            </div>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Chiet khau
          </span>
          <input
            type="number"
            min={0}
            disabled={!isEditing}
            value={draft.discount}
            onChange={(event) => onDiscountChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
          />
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
            Phi ship
          </span>
          <input
            type="number"
            min={0}
            disabled={!isEditing}
            value={draft.shippingFee}
            onChange={(event) => onShippingFeeChange(event.target.value)}
            className="h-11 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
          />
        </label>
      </div>

      <label className="block space-y-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted">
          Ghi chu don hang
        </span>
        <textarea
          rows={4}
          disabled={!isEditing}
          value={draft.notes}
          onChange={(event) => onNotesChange(event.target.value)}
          placeholder="Ghi chu xu ly, huong dan giao hang, thong tin nghiep vu..."
          className="w-full rounded-3xl border border-border bg-background px-4 py-3 text-sm text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
        />
      </label>
    </PageContent>
  )
}
