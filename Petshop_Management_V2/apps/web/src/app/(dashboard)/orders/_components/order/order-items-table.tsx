'use client'

import { Trash2 } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'
import { formatCurrency } from '@/lib/utils'
import { getCartQuantityStep } from './order.utils'

interface OrderItemsTableProps {
  items: any[]
  isEditing: boolean
  onChangeQuantity: (index: number, value: string) => void
  onChangeUnitPrice: (index: number, value: string) => void
  onRemoveItem: (index: number) => void
}

export function OrderItemsTable({
  items,
  isEditing,
  onChangeQuantity,
  onChangeUnitPrice,
  onRemoveItem,
}: OrderItemsTableProps) {
  return (
    <PageContent className="space-y-2">
      <div className="hidden border-b border-border px-2 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted md:flex">
        <div className="flex-1">Ten san pham / Dich vu</div>
        <div className="w-[90px] text-center">So luong</div>
        <div className="w-[120px] text-right">Don gia</div>
        <div className="w-[120px] text-right">Thanh tien</div>
        {isEditing ? <div className="w-8 shrink-0" /> : null}
      </div>

      {items.map((item, index) => (
        <div
          key={`${item.id}-${index}`}
          className="flex flex-col gap-3 rounded-2xl border border-border bg-background-secondary/60 p-3 md:flex-row md:items-center md:border-transparent md:bg-transparent md:p-1 md:py-2"
        >
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <div className="truncate text-sm font-semibold text-foreground" title={item.description}>
                {item.description}
              </div>
              <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-primary-700">
                {item.type}
              </span>
            </div>
            <div className="mt-1 truncate text-xs text-foreground-muted">
              {[item.variantName, item.petName].filter(Boolean).join(' • ') || '---'}
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <div className="w-[90px] shrink-0">
              <input
                type="number"
                step={getCartQuantityStep(item)}
                min={getCartQuantityStep(item)}
                disabled={!isEditing}
                value={item.quantity}
                onChange={(event) => onChangeQuantity(index, event.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-2 text-center text-sm font-medium text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
              />
            </div>

            <div className="w-[120px] shrink-0">
              <input
                type="number"
                min={0}
                disabled={!isEditing}
                value={item.unitPrice}
                onChange={(event) => onChangeUnitPrice(index, event.target.value)}
                className="h-9 w-full rounded-xl border border-border bg-background px-2 text-right text-sm font-medium text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
              />
            </div>

            <div className="w-[120px] shrink-0 text-right text-sm font-semibold text-foreground">
              {formatCurrency(
                Math.max(
                  0,
                  Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discountItem || 0),
                ),
              )}
            </div>

            {isEditing ? (
              <div className="flex w-8 shrink-0 items-center justify-end">
                <button
                  type="button"
                  onClick={() => onRemoveItem(index)}
                  className="text-foreground-muted transition-colors hover:text-error"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ))}

      {items.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-border px-5 py-12 text-center">
          <div className="text-sm font-semibold text-foreground">Chua co san pham nao</div>
          <div className="mt-1 text-sm text-foreground-muted">Tim va them item ngay tren workspace Orders nay.</div>
        </div>
      ) : null}
    </PageContent>
  )
}
