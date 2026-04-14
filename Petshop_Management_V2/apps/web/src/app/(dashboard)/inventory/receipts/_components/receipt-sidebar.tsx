import React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import { Building2, X, History, UserPlus, Phone, Plus, CalendarDays } from 'lucide-react'
import { NumericFormat } from 'react-number-format'


import { getReceiptStatusView , fmt } from './receipt/receipt.utils'
import { useReceiptForm } from './receipt/use-receipt-form'

interface ReceiptSidebarProps {
  form: ReturnType<typeof useReceiptForm>
}

export function ReceiptSidebar({ form }: ReceiptSidebarProps) {
  const {
    isExistingReceipt,
    isEditMode,
    receipt,
    selectedSupplier,
    setSupplierId,
    supplierQuery,
    setSupplierQuery,
    applyLatestSupplierPricesToItems,
    currentDebt,
    supplierReceipts,
    handleOpenQuickSupplier,
    showSupplierSearch,
    setShowSupplierSearch,
    filteredSuppliers,
    handleSelectSupplier,
    suppliers,
    branchId,
    setBranchId,
    allowedBranches,
    currentBranch,
    items,
    merchandiseTotal,
    receiptDiscount,
    setReceiptDiscount,
    isReadOnly,
    grandTotal,
    taxAmount,
    setReceiptTax,
    enhancedActivityTimelineEntries,
    notes,
    setNotes,
    handleSubmit,
    saveMutation
  } = form

  const statusView = getReceiptStatusView(receipt)

  return (
    <div className="flex min-h-0 w-[420px] shrink-0 flex-col overflow-y-auto border-l border-border bg-background custom-scrollbar">
      {/* Supplier card */}
      <div className="p-3 border-b border-border">
        {selectedSupplier ? (
          <div className="group relative rounded-xl border border-border bg-background-secondary p-3 transition-colors hover:border-primary-500/30">
            <button
              type="button"
              onClick={() => {
                setSupplierId('')
                setSupplierQuery('')
              }}
              className="absolute right-2.5 top-2.5 flex h-5 w-5 items-center justify-center rounded-full text-foreground-muted opacity-0 transition-all group-hover:opacity-100 hover:bg-error/10 hover:text-error"
            >
              <X size={12} />
            </button>
            <div className="pr-6">
              <div className="text-sm font-bold text-primary-500 leading-tight">
                {selectedSupplier.name}
              </div>
              {selectedSupplier.phone && (
                <div className="mt-0.5 text-xs text-foreground-muted">
                  {selectedSupplier.phone}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={applyLatestSupplierPricesToItems}
              className="mt-2 inline-flex items-center gap-1 rounded-lg border border-primary-500/30 bg-primary-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary-500 transition-colors hover:border-primary-500/50 hover:bg-primary-500/15"
            >
              <History size={11} />
              Áp giá NCC gần nhất
            </button>
            {currentDebt > 0 && (
              <div className="mt-2 flex items-center gap-1.5 rounded-lg bg-error/8 px-2.5 py-1.5">
                <span className="text-xs text-foreground-muted">Công nợ:</span>
                <span className="text-xs font-bold text-error">{fmt(currentDebt)}</span>
              </div>
            )}

            <div className="mt-3 overflow-hidden rounded-lg border border-border bg-background">
              <div className="flex items-center gap-2 border-b border-border px-2.5 py-2">
                <History size={12} className="text-primary-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wide text-foreground-muted">
                  Lịch sử nhập gần đây
                </span>
              </div>

              {supplierReceipts.length > 0 ? (
                <div className="divide-y divide-border">
                  {supplierReceipts.slice(0, 4).map((receipt: any) => (
                    <Link
                      key={receipt.id}
                      href={`/dashboard/inventory/receipts/${receipt.receiptNumber || receipt.id}`}
                      className="flex items-center justify-between gap-3 px-2.5 py-2 transition-colors hover:bg-background-secondary"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-[11px] font-semibold text-foreground">
                          {receipt.receiptNumber || receipt.id?.slice(0, 8)?.toUpperCase()}
                        </div>
                        <div className="mt-0.5 text-[10px] text-foreground-muted">
                          {dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm')}
                        </div>
                      </div>
                      <div className="text-right text-[11px] font-semibold text-primary-500">
                        {fmt(Number(receipt.totalAmount ?? 0))}
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="px-2.5 py-2.5 text-[11px] text-foreground-muted">
                  Chưa có lịch sử nhập với nhà cung cấp này.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="relative">
            <Building2
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
            />
            <input
              type="text"
              className="h-10 w-full rounded-xl border border-border bg-background-secondary pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
              placeholder="Tìm nhà cung cấp"
              value={supplierQuery}
              onChange={(e) => {
                setSupplierQuery(e.target.value)
                setShowSupplierSearch(true)
              }}
              onFocus={() => setShowSupplierSearch(true)}
            />
            <button
              type="button"
              onClick={handleOpenQuickSupplier}
              className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-md text-foreground-muted transition-colors hover:bg-background hover:text-primary-500"
              title="Thêm nhà cung cấp nhanh"
            >
              <UserPlus size={14} />
            </button>

            {showSupplierSearch ? (
              <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {filteredSuppliers.map((supplier: any) => (
                    <button
                      key={supplier.id}
                      type="button"
                      className="flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left transition-colors last:border-0 hover:bg-background-secondary"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => handleSelectSupplier(supplier)}
                    >
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
                        <Building2 size={15} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-medium text-foreground">
                          {supplier.name}
                        </div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                          {supplier.phone ? (
                            <span className="inline-flex items-center gap-1">
                              <Phone size={11} />
                              {supplier.phone}
                            </span>
                          ) : (
                            <span>Không có SĐT</span>
                          )}
                        </div>
                      </div>
                      {Number(supplier.debt ?? 0) > 0 ? (
                        <div className="text-right text-[11px] font-semibold text-error">
                          {fmt(Number(supplier.debt ?? 0))}
                        </div>
                      ) : null}
                    </button>
                  ))}

                  {supplierQuery.trim() && filteredSuppliers.length === 0 ? (
                    <div className="space-y-3 px-3 py-4">
                      <div className="text-sm text-foreground-muted">
                        Không tìm thấy nhà cung cấp phù hợp
                      </div>
                      <button
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={handleOpenQuickSupplier}
                        className="btn-primary w-full justify-center rounded-xl py-2 text-sm"
                      >
                        <Plus size={14} />
                        Thêm nhanh &quot;{supplierQuery.trim()}&quot;
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

          <select
            className="hidden"
            value={form.supplierId || ''}
            onChange={(e) => setSupplierId(e.target.value)}
          >
            <option value="">— Chọn nhà cung cấp —</option>
            {suppliers.map((s: any) => (
              <option key={s.id} value={s.id}>
                {s.name}
                {s.phone ? ` · ${s.phone}` : ''}
              </option>
            ))}
          </select>
          </div>
        )}

        {/* Branch */}
        <div className="mt-2">
          <select
            className="form-input h-10 cursor-pointer text-sm"
            value={branchId}
            onChange={(e) => setBranchId(e.target.value)}
          >
            <option value="">Chọn chi nhánh nhận hàng</option>
            {allowedBranches.map((b: any) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="hidden border-b border-border px-3 py-3">
        <div className="rounded-xl border border-border bg-background-secondary p-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                Nhà cung cấp
              </div>
              <div className="mt-2 truncate text-sm font-semibold text-foreground">
                {selectedSupplier?.name || 'Chưa chọn nhà cung cấp'}
              </div>
              <div className="mt-1 truncate text-xs text-foreground-muted">
                {selectedSupplier?.phone || currentBranch?.name || 'Chọn NCC ở thanh trên'}
              </div>
            </div>
            {currentDebt > 0 ? (
              <div className="rounded-lg bg-error/10 px-2 py-1 text-[11px] font-semibold text-error">
                Nợ: {fmt(currentDebt)}
              </div>
            ) : null}
          </div>

          {supplierReceipts.length > 0 ? (
            <div className="mt-3 space-y-2 border-t border-border pt-3">
              {supplierReceipts.slice(0, 3).map((receipt: any) => (
                <Link
                  key={receipt.id}
                  href={`/dashboard/inventory/receipts/${receipt.receiptNumber || receipt.id}`}
                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 transition-colors hover:bg-background"
                >
                  <div className="min-w-0">
                    <div className="truncate text-[11px] font-semibold text-foreground">
                      {receipt.receiptNumber || receipt.id?.slice(0, 8)?.toUpperCase()}
                    </div>
                    <div className="text-[10px] text-foreground-muted">
                      {dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm')}
                    </div>
                  </div>
                  <div className="text-[11px] font-semibold text-primary-500">
                    {fmt(Number(receipt.totalAmount ?? 0))}
                  </div>
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* Order meta */}
      <div className="hidden border-b border-border px-3 py-2.5 space-y-1.5">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Mã đặt hàng nhập</span>
          <span className="text-xs italic text-foreground-muted">Tự động</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Trạng thái</span>
          <span className="badge badge-warning text-[11px]">Đặt hàng</span>
        </div>
      </div>

      {/* Totals */}
      <div className="border-b border-border px-3 py-3 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-foreground-muted flex items-center gap-1.5">
            Tổng tiền hàng
            {items.length > 0 && (
              <span className="badge badge-primary text-[10px] px-1.5 py-0">
                {items.length}
              </span>
            )}
          </span>
          <span className="text-sm font-semibold text-foreground tabular-nums">
            {fmt(merchandiseTotal)}
          </span>
        </div>

        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-foreground-muted shrink-0">Giảm giá</span>
          <NumericFormat
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            className="h-7 w-28 rounded-lg border border-border bg-background-secondary px-2 text-right text-sm text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            value={receiptDiscount || ''}
            placeholder="0"
            onValueChange={(values) => setReceiptDiscount(Math.max(0, values.floatValue || 0))}
            disabled={isReadOnly}
          />
        </div>

        {/* Extra costs – hidden from UI but still computed for legacy data */}

        {/* Grand total */}
        <div className="flex items-center justify-between rounded-xl bg-background-secondary px-3 py-2.5 border border-border">
          <span className="text-sm font-semibold text-foreground">Cần trả NCC</span>
          <span className="text-base font-black text-primary-500 tabular-nums">
            {fmt(grandTotal)}
          </span>
        </div>
      </div>

      {/* Payment info */}
      <div className="border-b border-border px-3 py-2.5 space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Tiền trả NCC (F8)</span>
          <span className="text-xs font-medium text-foreground">0</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Tính vào công nợ</span>
          <span className="text-xs font-semibold text-foreground tabular-nums">
            {fmt(grandTotal)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-foreground-muted shrink-0">Chi phí phát sinh</span>
          <NumericFormat
            thousandSeparator="."
            decimalSeparator=","
            allowNegative={false}
            className="h-6 w-24 rounded-lg border border-border bg-background-secondary px-2 text-right text-xs text-foreground outline-none focus:border-primary-500"
            value={taxAmount || ''}
            placeholder="0"
            onValueChange={(values) => setReceiptTax(Math.max(0, values.floatValue || 0))}
            disabled={isReadOnly}
          />
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-foreground-muted">Dự kiến ngày nhập hàng</span>
          <button
            type="button"
            className="text-foreground-muted hover:text-primary-500 transition-colors"
          >
            <CalendarDays size={14} />
          </button>
        </div>
      </div>

      {isExistingReceipt && (
        <div className="border-b border-border px-3 py-3">
          <div className="rounded-xl border border-border bg-background-secondary p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                Lịch sử
              </div>
              <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusView.toneClass}`}>
                {statusView.label}
              </span>
            </div>

            <div className="mt-3 space-y-3">
              {enhancedActivityTimelineEntries.map((entry: any, index: number) => (
                <div key={`${entry.title}-${entry.time}-${entry.detail}-${index}`} className="grid grid-cols-[18px_1fr] gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`mt-1 h-2.5 w-2.5 rounded-full ${entry.tone === 'text-primary-500' ? 'bg-primary-500' : entry.tone === 'text-amber-500' ? 'bg-amber-500' : 'bg-border'}`} />
                    {index < enhancedActivityTimelineEntries.length - 1 ? (
                      <span className="mt-1 h-full w-px bg-border" />
                    ) : null}
                  </div>
                  <div className="pb-1">
                    <div className={`text-sm font-semibold ${entry.tone}`}>{entry.title}</div>
                    <div className="mt-0.5 text-xs text-foreground">{entry.detail}</div>
                    {entry.href && entry.linkLabel ? (
                      <Link
                        href={entry.href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex text-[11px] font-medium text-amber-400 transition-colors hover:text-amber-300"
                      >
                        {entry.linkLabel}
                      </Link>
                    ) : null}
                    <div className="mt-0.5 text-[11px] text-foreground-muted">{entry.time}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Notes */}
      <div className="px-3 py-2.5 mb-20 md:mb-0">
        <textarea
          rows={1}
          className="w-full resize-none rounded-xl border border-border bg-background-secondary p-2.5 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all overflow-hidden"
          placeholder="Ghi chú cho đơn hàng..."
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            e.target.style.height = 'auto'
            e.target.style.height = `${e.target.scrollHeight}px`
          }}
        />
      </div>

      {/* Action buttons */}
      {!isExistingReceipt && (
        <div className="shrink-0 border-t border-border p-3 flex gap-2.5">
          <button
            type="button"
            onClick={() => handleSubmit('draft')}
            disabled={saveMutation.isPending || items.length === 0 || !branchId}
            className="btn-primary flex-1 rounded-xl py-2.5 text-sm justify-center disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saveMutation.isPending ? 'Đang xử lý...' : isEditMode ? 'Cập nhật phiếu nháp' : 'Tạo đơn nhập'}
          </button>
        </div>
      )}
    </div>
  )
}
