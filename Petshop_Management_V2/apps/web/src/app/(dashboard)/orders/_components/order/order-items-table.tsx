'use client'
import Image from 'next/image';

import type { KeyboardEvent } from 'react'
import { useEffect, useRef, useState } from 'react'
import { Minus, Package2, Percent, Plus, Trash2 } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import { getCartQuantityStep } from './order.utils'
import { OrderStockPopover } from './order-stock-popover'


type DiscountMode = 'amount' | 'percent'

interface OrderItemsTableProps {
  items: any[]
  isEditing: boolean
  selectedRowIndex: number
  onSelectRow: (index: number) => void
  onChangeQuantity: (index: number, value: string) => void
  onChangeItemDiscount: (index: number, value: string) => void
  onRemoveItem: (index: number) => void
}

function getItemCode(item: any) {
  return item.sku || item.productVariantId || item.productId || item.serviceVariantId || item.serviceId || '-'
}

function getItemMeta(item: any) {
  const variantName = item.variantName && item.variantName !== item.description ? item.variantName : null
  return [variantName, item.petName, item.type].filter(Boolean).join(' • ')
}

function clampLineDiscount(discountValue: number, lineBasePrice: number) {
  return Math.max(0, Math.min(discountValue, lineBasePrice))
}

function getDiscountPercent(item: any) {
  const quantity = Math.max(Number(item.quantity || 0), 0)
  const unitPrice = Math.max(Number(item.unitPrice || 0), 0)
  const lineBasePrice = quantity * unitPrice
  if (lineBasePrice <= 0) return 0
  return (Math.max(Number(item.discountItem || 0), 0) / lineBasePrice) * 100
}

export function OrderItemsTable({
  items,
  isEditing,
  selectedRowIndex,
  onSelectRow,
  onChangeQuantity,
  onChangeItemDiscount,
  onRemoveItem,
}: OrderItemsTableProps) {
  const [editingDiscountIndex, setEditingDiscountIndex] = useState<number | null>(null)
  const [discountModes, setDiscountModes] = useState<Record<number, DiscountMode>>({})
  const rowRefs = useRef<Array<HTMLDivElement | null>>([])
  const tableColumns = isEditing
    ? '58px 64px 112px 140px minmax(220px,1fr) 90px 132px 168px 150px'
    : '64px 112px 140px minmax(220px,1fr) 90px 132px 168px 150px'

  useEffect(() => {
    if (editingDiscountIndex === null) return
    if (editingDiscountIndex < items.length) return
    setEditingDiscountIndex(null)
  }, [editingDiscountIndex, items.length])

  useEffect(() => {
    if (selectedRowIndex < 0) return
    rowRefs.current[selectedRowIndex]?.scrollIntoView({ block: 'nearest' })
    rowRefs.current[selectedRowIndex]?.focus({ preventScroll: true })
  }, [selectedRowIndex])

  const focusRow = (index: number) => {
    requestAnimationFrame(() => {
      rowRefs.current[index]?.focus({ preventScroll: true })
    })
  }

  const adjustQuantity = (index: number, item: any, delta: number) => {
    const quantityStep = getCartQuantityStep(item)
    const nextQuantity = Math.max(quantityStep, Number(item.quantity || 0) + delta)
    onChangeQuantity(index, String(nextQuantity))
  }

  const handleRowKeyDown = (event: KeyboardEvent<HTMLElement>, index: number, item: any) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(event.key)) return

    event.preventDefault()
    event.stopPropagation()

    if (event.key === 'ArrowUp' && index > 0) {
      onSelectRow(index - 1)
      focusRow(index - 1)
      return
    }

    if (event.key === 'ArrowDown' && index < items.length - 1) {
      onSelectRow(index + 1)
      focusRow(index + 1)
      return
    }

    onSelectRow(index)

    if (!isEditing) return

    if (event.key === 'ArrowLeft') {
      adjustQuantity(index, item, -getCartQuantityStep(item))
      return
    }

    if (event.key === 'ArrowRight') {
      adjustQuantity(index, item, getCartQuantityStep(item))
    }
  }

  const applyDiscountValue = (index: number, item: any, rawValue: string, mode: DiscountMode) => {
    const parsedValue = Number(rawValue || 0)
    const safeValue = Number.isFinite(parsedValue) ? Math.max(0, parsedValue) : 0
    const quantity = Math.max(Number(item.quantity || 0), 0)
    const unitPrice = Math.max(Number(item.unitPrice || 0), 0)
    const lineBasePrice = quantity * unitPrice

    if (mode === 'percent') {
      const percent = Math.min(safeValue, 100)
      const percentDiscount = clampLineDiscount((lineBasePrice * percent) / 100, lineBasePrice)
      onChangeItemDiscount(index, String(percentDiscount))
      return
    }

    onChangeItemDiscount(index, String(clampLineDiscount(safeValue, lineBasePrice)))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-border bg-background-secondary/55">
        <div
          className="grid items-center px-2 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-foreground-muted"
          style={{ gridTemplateColumns: tableColumns }}
        >
          {isEditing ? <div className="text-center">Xóa</div> : null}
          <div className="text-center">STT</div>
          <div className="text-center">Ảnh</div>
          <div className="pl-1">SKU</div>
          <div className="pl-1">Tên hàng</div>
          <div className="text-center">ĐVT</div>
          <div className="text-center">Số lượng</div>
          <div className="pr-1 text-right">Đơn giá / CK</div>
          <div className="pr-4 text-right">Thành tiền</div>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-foreground-muted">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-border bg-background">
            <Package2 size={28} className="opacity-40" />
          </div>
          <div className="text-sm font-semibold text-foreground">Chưa có sản phẩm hoặc dịch vụ</div>
          <div className="text-sm text-foreground-muted">
            Dùng thanh tìm kiếm phía trên để thêm item vào đơn hàng.
          </div>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {items.map((item, index) => {
            const quantity = Math.max(Number(item.quantity || 0), 0)
            const unitPrice = Math.max(Number(item.unitPrice || 0), 0)
            const lineBasePrice = quantity * unitPrice
            const quantityStep = getCartQuantityStep(item)
            const itemDiscount = clampLineDiscount(Number(item.discountItem || 0), lineBasePrice)
            const itemTotal = Math.max(0, lineBasePrice - itemDiscount)
            const isSelected = selectedRowIndex === index
            const effectiveUnitPrice = quantity > 0 ? itemTotal / quantity : unitPrice
            const activeDiscountMode = discountModes[index] ?? 'amount'
            const currentDiscountValue =
              activeDiscountMode === 'percent'
                ? Number(getDiscountPercent(item).toFixed(2))
                : itemDiscount

            return (
              <div
                key={`${item.id}-${index}`}
                ref={(element) => {
                  rowRefs.current[index] = element
                }}
                tabIndex={0}
                onClick={() => onSelectRow(index)}
                onFocus={() => onSelectRow(index)}
                onKeyDown={(event) => handleRowKeyDown(event, index, item)}
                className={`group grid items-center border-b border-border px-2 py-3 transition-colors last:border-b-0 ${isSelected
                  ? 'bg-primary-500/8 ring-1 ring-inset ring-primary-500/35'
                  : 'hover:bg-background-secondary/30'
                  }`}
                style={{ gridTemplateColumns: tableColumns }}
              >
                {isEditing ? (
                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => onRemoveItem(index)}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                ) : null}

                <div className="text-center text-sm font-medium text-foreground-muted">{index + 1}</div>

                <div className="flex justify-center">
                  <div className="flex h-11 w-11 items-center justify-center overflow-hidden rounded-xl border border-border bg-background text-foreground-muted">
                    {item.image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <Image src={item.image} alt={item.description} className="h-full w-full object-cover" width={400} height={400} unoptimized />
                    ) : (
                      <Package2 size={16} />
                    )}
                  </div>
                </div>

                <div className="min-w-0 pr-3">
                  <div className="truncate text-sm font-semibold uppercase tracking-[0.08em] text-primary-500">
                    {getItemCode(item)}
                  </div>
                </div>

                <div className="min-w-0 pr-3">
                  <div className="flex items-start gap-1">
                    <div className="truncate text-sm font-semibold text-foreground" title={item.description}>
                      {item.description}
                    </div>
                    <OrderStockPopover item={item} />
                  </div>
                  <div className="mt-1 truncate text-xs text-foreground-muted">{getItemMeta(item) || '-'}</div>
                </div>

                <div className="text-center text-sm text-foreground-muted">{item.unit || '-'}</div>

                <div className="px-2">
                  <div className="flex h-10 items-center rounded-xl border border-border bg-background">
                    <button
                      type="button"
                      onClick={() => adjustQuantity(index, item, -quantityStep)}
                      disabled={!isEditing || item.type === 'hotel'}
                      className="inline-flex h-full w-10 items-center justify-center rounded-l-xl text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Minus size={14} />
                    </button>
                    <input
                      type="number"
                      step={quantityStep}
                      min={quantityStep}
                      disabled={!isEditing || item.type === 'hotel'}
                      value={item.quantity}
                      onFocus={() => onSelectRow(index)}
                      onChange={(event) => onChangeQuantity(index, event.target.value)}
                      onKeyDown={(event) => handleRowKeyDown(event, index, item)}
                      className="h-full w-full border-x border-border bg-transparent px-2 text-center text-sm font-semibold text-foreground outline-none disabled:cursor-not-allowed disabled:text-foreground-muted"
                    />
                    <button
                      type="button"
                      onClick={() => adjustQuantity(index, item, quantityStep)}
                      disabled={!isEditing || item.type === 'hotel'}
                      className="inline-flex h-full w-10 items-center justify-center rounded-r-xl text-foreground-muted transition-colors hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                <div className="pr-1">
                  <div className="relative">
                    {isEditing ? (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectRow(index)
                          setEditingDiscountIndex((current) => {
                            const nextValue = current === index ? null : index
                            if (nextValue === index) {
                              setDiscountModes((currentModes) => ({
                                ...currentModes,
                                [index]: currentModes[index] ?? 'amount',
                              }))
                            }
                            return nextValue
                          })
                        }}
                        className="flex h-12 w-full flex-col items-end justify-center rounded-xl border border-border bg-background px-3 text-right transition-colors hover:border-primary-500/40"
                      >
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(effectiveUnitPrice)}
                        </span>
                        {itemDiscount > 0 ? (
                          <span className="text-[10px] font-medium text-rose-400 line-through">
                            {formatCurrency(unitPrice)}
                          </span>
                        ) : null}
                      </button>
                    ) : (
                      <div className="flex h-12 w-full flex-col items-end justify-center rounded-xl border border-border bg-background-secondary px-3 text-right">
                        <span className="text-sm font-semibold text-foreground">
                          {formatCurrency(effectiveUnitPrice)}
                        </span>
                        {itemDiscount > 0 ? (
                          <span className="text-[10px] font-medium text-rose-400 line-through">
                            {formatCurrency(unitPrice)}
                          </span>
                        ) : null}
                      </div>
                    )}

                    {isEditing && editingDiscountIndex === index ? (
                      <div className="absolute right-0 top-[calc(100%+8px)] z-20 w-60 rounded-2xl border border-border bg-background p-3 shadow-2xl">
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 rounded-xl bg-background-secondary p-1">
                            <button
                              type="button"
                              onClick={() => setDiscountModes((current) => ({ ...current, [index]: 'amount' }))}
                              className={`inline-flex h-9 flex-1 items-center justify-center rounded-lg text-sm font-semibold transition-colors ${activeDiscountMode === 'amount'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-foreground-muted hover:text-foreground'
                                }`}
                            >
                              Theo tiền
                            </button>
                            <button
                              type="button"
                              onClick={() => setDiscountModes((current) => ({ ...current, [index]: 'percent' }))}
                              className={`inline-flex h-9 flex-1 items-center justify-center gap-1 rounded-lg text-sm font-semibold transition-colors ${activeDiscountMode === 'percent'
                                ? 'bg-background text-foreground shadow-sm'
                                : 'text-foreground-muted hover:text-foreground'
                                }`}
                            >
                              <Percent size={13} />
                              Theo %
                            </button>
                          </div>

                          <label className="block space-y-1">
                            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">
                              Chiết khấu sản phẩm
                            </span>
                            <div className="relative">
                              <input
                                type="number"
                                min={0}
                                max={activeDiscountMode === 'percent' ? 100 : lineBasePrice}
                                step={activeDiscountMode === 'percent' ? 0.01 : 1000}
                                value={currentDiscountValue}
                                onChange={(event) =>
                                  applyDiscountValue(index, item, event.target.value, activeDiscountMode)
                                }
                                className="h-10 w-full rounded-xl border border-border bg-background-secondary px-3 pr-10 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                              />
                              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-foreground-muted">
                                {activeDiscountMode === 'percent' ? '%' : 'đ'}
                              </span>
                            </div>
                          </label>

                          <div className="rounded-xl border border-border bg-background-secondary/55 px-3 py-2.5 text-xs text-foreground-muted">
                            {activeDiscountMode === 'percent'
                              ? `Tương đương ${formatCurrency(itemDiscount)} trên dòng hàng này`
                              : `Tương đương ${getDiscountPercent(item).toFixed(getDiscountPercent(item) % 1 === 0 ? 0 : 2)}%`}
                          </div>

                          <button
                            type="button"
                            onClick={() => setEditingDiscountIndex(null)}
                            className="inline-flex h-9 w-full items-center justify-center rounded-xl border border-border bg-background-secondary text-sm font-semibold text-foreground transition-colors hover:bg-background-tertiary"
                          >
                            Xong
                          </button>
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className="pr-4 text-right text-[18px] font-bold text-foreground tabular-nums">
                  {formatCurrency(itemTotal)}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}