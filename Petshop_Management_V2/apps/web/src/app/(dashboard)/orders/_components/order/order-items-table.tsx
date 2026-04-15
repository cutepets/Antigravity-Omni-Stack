'use client'

import { Minus, Package2, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getCartQuantityStep } from './order.utils'

interface OrderItemsTableProps {
  items: any[]
  isEditing: boolean
  onChangeQuantity: (index: number, value: string) => void
  onChangeUnitPrice: (index: number, value: string) => void
  onRemoveItem: (index: number) => void
}

const TABLE_COLUMNS = '58px 64px 112px minmax(240px,1fr) 90px 132px 140px 150px 58px'

function getItemCode(item: any) {
  return item.sku || item.productVariantId || item.productId || item.serviceVariantId || item.serviceId || '—'
}

function getItemMeta(item: any) {
  return [item.variantName, item.petName, item.type].filter(Boolean).join(' • ')
}

export function OrderItemsTable({
  items,
  isEditing,
  onChangeQuantity,
  onChangeUnitPrice,
  onRemoveItem,
}: OrderItemsTableProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Table Header */}
      <div className="shrink-0 border-b border-border bg-background-secondary/55">
        <div
          className="grid items-center px-2 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted"
          style={{ gridTemplateColumns: TABLE_COLUMNS }}
        >
          <div className="text-center">Xóa</div>
          <div className="text-center">STT</div>
          <div className="text-center">Ảnh</div>
          <div className="pl-1">Tên hàng</div>
          <div className="text-center">ĐVT</div>
          <div className="text-center">Số lượng</div>
          <div className="pr-1 text-right">Đơn giá</div>
          <div className="pr-4 text-right">Thành tiền</div>
          <div />
        </div>
      </div>

      {/* Table Body */}
      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-foreground-muted">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background">
            <Package2 size={28} className="opacity-40" />
          </div>
          <div className="text-sm font-semibold text-foreground">Chưa có sản phẩm hoặc dịch vụ</div>
          <div className="text-sm text-foreground-muted">Dùng thanh tìm kiếm phía trên để thêm item vào đơn hàng.</div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {items.map((item, index) => {
            const quantityStep = getCartQuantityStep(item)
            const itemTotal =
              Math.max(0, Number(item.quantity || 0) * Number(item.unitPrice || 0) - Number(item.discountItem || 0))

            return (
              <div
                key={`${item.id}-${index}`}
                className="grid items-center border-b border-border px-2 py-3 transition-colors last:border-b-0 hover:bg-background-secondary/30"
                style={{ gridTemplateColumns: TABLE_COLUMNS }}
              >
                <div className="flex justify-center">
                  {isEditing ? (
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  ) : (
                    <span className="text-foreground-muted/40">—</span>
                  )}
                </div>

                <div className="text-center text-sm font-medium text-foreground-muted">{index + 1}</div>

                <div className="flex justify-center">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-foreground-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={item.image} alt={item.description} className="h-full w-full object-cover" />
                    ) : (
                      <Package2 size={16} />
                    )}
                  </div>
                </div>

                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-semibold text-foreground" title={item.description}>
                    {item.description}
                  </div>
                  <div className="mt-1 flex items-center gap-2 text-xs text-foreground-muted">
                    <span className="font-medium uppercase tracking-wide text-primary-500">{getItemCode(item)}</span>
                    <span className="truncate">{getItemMeta(item) || '—'}</span>
                  </div>
                </div>

                <div className="text-center text-sm text-foreground-muted">{item.unit || '—'}</div>

                <div className="px-2">
                  <div className="flex h-10 items-center rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeQuantity(
                          index,
                          String(Math.max(quantityStep, Number(item.quantity || 0) - quantityStep)),
                        )
                      }
                      disabled={!isEditing}
                      className="inline-flex h-full w-10 items-center justify-center rounded-l-xl text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step={quantityStep}
                      min={quantityStep}
                      disabled={!isEditing}
                      value={item.quantity}
                      onChange={(event) => onChangeQuantity(index, event.target.value)}
                      className="h-full w-full border-x border-border bg-transparent px-2 text-center text-sm font-semibold text-foreground outline-none disabled:cursor-not-allowed disabled:text-foreground-muted"
                    />
                    <button
                      type="button"
                      onClick={() => onChangeQuantity(index, String(Number(item.quantity || 0) + quantityStep))}
                      disabled={!isEditing}
                      className="inline-flex h-full w-10 items-center justify-center rounded-r-xl text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="pr-1">
                  <input
                    type="number"
                    min={0}
                    disabled={!isEditing}
                    value={item.unitPrice}
                    onChange={(event) => onChangeUnitPrice(index, event.target.value)}
                    className="h-10 w-full rounded-xl border border-border bg-background px-3 text-right text-sm font-semibold text-foreground outline-none transition-colors disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                  />
                </div>

                <div className="pr-4 text-right text-[18px] font-bold text-foreground tabular-nums">
                  {formatCurrency(itemTotal)}
                </div>

                <div />
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
