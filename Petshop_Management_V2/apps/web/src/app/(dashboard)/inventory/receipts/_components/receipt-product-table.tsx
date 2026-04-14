import React from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  ChevronDown,
  Copy,
  Minus,
  Package2,
  Plus,
  ScanSearch,
  Search,
  Trash2,
  X
} from 'lucide-react'
import { NumericFormat } from 'react-number-format'


import {
  isConversionVariant,
  getTrueVariants,
  getVariantShortLabel,
  findParentTrueVariant,
  getConversionVariants,
  getVariantSnapshot,
  getItemIdentity
, fmt } from './receipt/receipt.utils'
import { StockPopover } from './receipt/stock-popover'
import { useReceiptForm } from './receipt/use-receipt-form'
import { SUPPLIER_RECEIPT_DRAFT_KEY } from './receipt/receipt.constants'
import { SupplierQuickDraftPayload } from './receipt/receipt.types'
import { customToast as toast } from '@/components/ui/toast-with-copy'

interface ReceiptProductTableProps {
  form: ReturnType<typeof useReceiptForm>
}

export function ReceiptProductTable({ form }: ReceiptProductTableProps) {
  const {
    isReadOnly,
    isExistingReceipt,
    receipt,
    resolvedReceiptId,
    supplierId,
    items,
    notes,
    searchPanelRef,
    searchInputRef,
    search,
    setSearch,
    handleSearchKeyDown,
    productResults,
    setIsSuggestionOpen,
    manualSearching,
    isSearchingSuggestions,
    isSuggestionOpen,
    highlightedIndex,
    addProductToReceipt,
    scanMode,
    setScanMode,
    exportMenuRef,
    showExportMenu,
    setShowExportMenu,
    isEditMode,
    isReceiptLocked,
    canUpdateReceipt,
    isEditingSession,
    handleSubmit,
    handleStartEditing,
    saveMutation,
    hasPendingReceiptChanges,
    branchId,
    selectedLineIds,
    removeSelectedItems,
    totalQuantity,
    toggleSelectAllLines,
    editingNoteForId,
    setEditingNoteForId,
    tempNote,
    setTempNote,
    updateItemNote,
    updateItemVariant,
    removeItem,
    toggleLineSelection,
    duplicateItem,
    mergeDuplicateItems,
    hasLockedReceiptQuantity,
    updateItem,
    branches
  } = form

  const allLinesSelected = items.length > 0 && selectedLineIds.length === items.length
  const cols = '36px 36px 52px 96px 1fr 64px 80px 112px 112px 88px 108px'

  const handleDuplicateReceipt = () => {
    if (!supplierId || items.length === 0) {
      toast.error('Đơn nhập cần có nhà cung cấp và ít nhất một sản phẩm để sao chép.')
      return
    }

    const draftPayload: SupplierQuickDraftPayload = {
      supplierId,
      notes,
      items: items.map((item: any) => ({
        productId: item.productId,
        productVariantId: item.productVariantId ?? null,
        name: item.name,
        sku: item.sku ?? item.baseSku ?? null,
        unit: item.unit ?? item.baseUnit ?? null,
        quantity: Math.max(1, Number(item.quantity ?? 1)),
        unitCost: Math.max(0, Number(item.unitCost ?? 0)),
      })),
    }

    window.localStorage.setItem(SUPPLIER_RECEIPT_DRAFT_KEY, JSON.stringify(draftPayload))
    window.open('/inventory/receipts/new', '_blank', 'noopener,noreferrer')
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* ─── TOP BAR ─────────────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-border bg-background px-4 py-2.5">
        <div className="flex min-w-[180px] items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-border bg-background-secondary text-primary-500">
            <Package2 size={18} />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">Tìm sản phẩm</div>
          </div>
        </div>
        <Link
          href="/inventory/receipts"
          className="hidden items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary-500 transition-colors"
        >
          <ArrowLeft size={16} />
          Đặt hàng nhập
        </Link>

        {/* Search bar */}
        <div ref={searchPanelRef} className="relative max-w-lg flex-1">
          <Search
            size={14}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
          />
          <input
            ref={searchInputRef}
            type="text"
            placeholder="Tìm hàng hóa theo tên, mã, barcode (F3)"
            className="h-9 w-full rounded-lg border border-border bg-background-secondary pl-9 pr-9 text-sm text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
            onFocus={() => {
              if (productResults.length > 0) setIsSuggestionOpen(true)
            }}
            disabled={manualSearching || isReadOnly}
          />
          {manualSearching || isSearchingSuggestions ? (
            <div className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-primary-500 border-t-transparent" />
          ) : (
            <ScanSearch
              size={13}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground-muted pointer-events-none"
            />
          )}

          {/* Suggestions dropdown */}
          {isSuggestionOpen && search.trim() && productResults.length > 0 && (
            <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-2xl">
              <div className="max-h-72 overflow-y-auto custom-scrollbar">
                {productResults.map((product: any, index: number) => (
                  <button
                    key={product.id}
                    type="button"
                    className={`flex w-full items-center gap-3 border-b border-border px-3 py-2.5 text-left text-sm last:border-0 transition-colors ${
                      index === highlightedIndex
                        ? 'bg-primary-500/10 text-primary-600'
                        : 'hover:bg-background-secondary'
                    }`}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => addProductToReceipt(product)}
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-tertiary">
                      {product.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package2 size={14} className="text-foreground-muted" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate font-medium text-foreground">{product.name}</div>
                      <div className="text-[11px] text-foreground-muted mt-0.5">
                        {product.sku || product.barcode || '—'}
                        {product.stock !== undefined && (
                          <span className="ml-2 text-primary-500 font-medium">
                            Tồn: {product.stock}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-semibold text-foreground">
                        {fmt(Number(product.costPrice ?? 0))}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <button
          type="button"
          onClick={() => {
            setScanMode((current: any) => !current)
            window.setTimeout(() => searchInputRef.current?.focus(), 10)
          }}
          className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${
            scanMode
              ? 'border-primary-500 bg-primary-500/10 text-primary-500'
              : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground'
          }`}
          title="Bật để máy quét barcode tự cộng dòng liên tục"
        >
          <ScanSearch size={14} />
        </button>

        {isExistingReceipt ? (
          <button
            type="button"
            onClick={handleDuplicateReceipt}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            title="Copy đơn nhập"
            aria-label="Copy đơn nhập"
          >
            <Copy size={14} />
          </button>
        ) : null}

        {isExistingReceipt && !isReceiptLocked && canUpdateReceipt ? (
          <button
            type="button"
            onClick={() => {
              if (isEditingSession) {
                handleSubmit('draft')
                return
              }
              handleStartEditing()
            }}
            disabled={
              isEditingSession
                ? saveMutation.isPending || !hasPendingReceiptChanges || items.length === 0 || !branchId
                : false
            }
            className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
              isEditingSession
                ? 'bg-primary-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]'
                : 'border border-border bg-background-secondary text-foreground hover:border-primary-500/30 hover:text-primary-500'
            }`}
          >
            {isEditingSession ? (saveMutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật') : 'Cập nhật'}
          </button>
        ) : null}

        {selectedLineIds.length > 0 && !isReadOnly ? (
          <button
            type="button"
            onClick={removeSelectedItems}
            className="inline-flex h-9 items-center gap-2 rounded-lg border border-error/30 bg-error/10 px-3 text-sm font-medium text-error transition-colors hover:bg-error/15"
          >
            <Trash2 size={14} />
            Xóa {selectedLineIds.length} dòng đã chọn
          </button>
        ) : null}
      </div>

      <div className="flex flex-1 overflow-hidden lg:grid lg:grid-cols-[200px_minmax(0,1fr)] xl:grid-cols-[260px_minmax(0,1fr)] max-lg:!block max-lg:[&>aside]:hidden max-lg:[&>div]:!h-full">
        <aside className="min-h-0 flex-col border-r border-border bg-background-secondary/30 hidden lg:flex w-[200px] xl:w-[260px]">
          <div className="border-b border-border px-4 py-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">Danh sách sản phẩm</div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {items.length} mặt hàng • {totalQuantity} số lượng
                </div>
              </div>
              <div className="rounded-full border border-border bg-background px-2.5 py-1 text-[11px] font-semibold text-primary-600">
                {items.length}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-border bg-background px-4 text-center">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background-secondary text-foreground-muted">
                  <Package2 size={22} />
                </div>
                <div className="text-[13px] font-medium text-foreground">Chưa có sản phẩm</div>
                <div className="text-[11px] text-foreground-muted px-2">
                  Tìm kiếm ở thanh trên để thêm hàng.
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                {items.map((item: any) => {
                  const snapshot = getVariantSnapshot(item)
                  const itemCode = snapshot.displaySku || snapshot.displayBarcode || '—'
                  const itemImage = snapshot.selectedVariant?.image || item.image
                  const lineAmount = item.quantity * item.unitCost - item.discount

                  return (
                    <div
                      key={item.lineId}
                      className="rounded-2xl border border-border bg-background px-3 py-3 shadow-sm"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-background-secondary">
                          {itemImage ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={itemImage}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package2 size={16} className="text-foreground-muted" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold text-foreground">
                            {item.name}
                          </div>
                          <div className="mt-1 truncate text-[11px] text-foreground-muted">
                            {itemCode}
                          </div>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-foreground-muted">
                            <span>SL: {item.quantity}</span>
                            <span>{fmt(lineAmount)}</span>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeItem(item.lineId)}
                          disabled={hasLockedReceiptQuantity(item)}
                          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </aside>
        
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          {/* Table header */}
          <div className="shrink-0 border-b border-border bg-background-secondary/60">
            <div
              className="grid items-center px-0 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
              style={{ gridTemplateColumns: cols }}
            >
              <div className="flex items-center justify-center">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-border bg-background text-primary-500 focus:ring-primary-500 outline-none accent-primary-500"
                  checked={allLinesSelected}
                  onChange={toggleSelectAllLines}
                  aria-label="Chọn tất cả sản phẩm"
                />
              </div>
              <div className="text-center">STT</div>
              <div className="text-center">Ảnh</div>
              <div className="pl-1">Mã hàng</div>
              <div>Tên hàng</div>
              <div className="text-center">ĐVT</div>
              <div className="text-center">Tồn kho</div>
              <div className="text-center">Số lượng</div>
              <div className="pr-1 text-right">Đơn giá</div>
              <div className="text-right">Giảm giá</div>
              <div className="pr-4 text-right">Thành tiền</div>
            </div>
          </div>

          {/* Table body */}
          <div className="flex-1 overflow-y-auto custom-scrollbar">
            {items.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-3 text-foreground-muted">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-background-secondary border border-border">
                  <Package2 size={28} className="opacity-40" />
                </div>
                <p className="text-sm font-medium">Chưa có hàng hóa trong đơn</p>
                <p className="text-xs text-foreground-muted">
                  Dùng thanh tìm kiếm phía trên để thêm sản phẩm
                </p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {items.map((item: any, idx: number) => {
                  const lineAmount = item.quantity * item.unitCost - item.discount
                  const isEditingNote = editingNoteForId === item.lineId
                  const variants = item.variants ?? []
                  const trueVariants = getTrueVariants(variants)
                  const snapshot = getVariantSnapshot(item)
                  const currentVariant = snapshot.selectedVariant
                  const isCurrentConversion = isConversionVariant(currentVariant)
                  const currentTrueVariant = currentVariant
                    ? findParentTrueVariant(variants, currentVariant)
                    : (trueVariants[0] ?? null)
                  const conversionVariants = getConversionVariants(variants, currentTrueVariant)
                  const itemCode = snapshot.displaySku || snapshot.displayBarcode || '—'
                  const unitLabel =
                    currentVariant && isConversionVariant(currentVariant)
                      ? getVariantShortLabel(currentVariant.name) || item.baseUnit || item.unit || '—'
                      : item.baseUnit || item.unit || '—'

                  const itemIdentity = getItemIdentity(item.productId, item.productVariantId)
                  const duplicateCount = items.filter(
                    (candidate: any) =>
                      candidate.lineId !== item.lineId &&
                      getItemIdentity(candidate.productId, candidate.productVariantId) === itemIdentity,
                  ).length
                  // Stock for current branch
                  const currentBranchStock = (() => {
                    if (!branchId || !snapshot.branchStocks?.length) return snapshot.totalStock
                    const bs = snapshot.branchStocks.find(
                      (s) => s.branchId === branchId || s.branch?.id === branchId,
                    )
                    if (!bs) return null
                    return bs.availableStock !== undefined && bs.availableStock !== null
                      ? bs.availableStock
                      : (bs.stock ?? 0) - (bs.reservedStock ?? 0)
                  })()

                  return (
                    <div
                      key={item.lineId}
                      className="group hover:bg-background-secondary/40 transition-colors"
                    >
                      <div
                        className="grid items-center py-3"
                        style={{ gridTemplateColumns: cols }}
                      >
                        <div className="flex justify-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-border bg-background text-primary-500 focus:ring-primary-500 outline-none accent-primary-500"
                            checked={selectedLineIds.includes(item.lineId)}
                            onChange={() => toggleLineSelection(item.lineId)}
                            aria-label={`Chọn sản phẩm ${snapshot.displayName}`}
                          />
                        </div>

                        {/* STT */}
                        <div className="text-center text-xs text-foreground-muted font-medium">
                          {idx + 1}
                        </div>

                        {/* Image */}
                        <div className="flex justify-center">
                          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-tertiary text-foreground-muted">
                            {item.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={item.image}
                                alt={snapshot.displayName}
                                className="h-full w-full object-cover"
                              />
                            ) : (
                              <Package2 size={16} />
                            )}
                          </div>
                        </div>

                        {/* Mã hàng */}
                        <div className="pl-1">
                          <span className="text-xs font-medium text-primary-500 hover:text-primary-600 cursor-pointer">
                            {itemCode}
                          </span>
                        </div>

                        {/* Tên hàng + ghi chú + Detail link + Stock popup */}
                        <div className="min-w-0 pr-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span
                              className="truncate text-sm font-medium text-foreground"
                              title={snapshot.displayName}
                            >
                              {snapshot.displayName}
                            </span>

                            {trueVariants.length > 0 ? (
                              <div className="relative shrink-0">
                                <select
                                  className="h-6 appearance-none rounded-md border border-orange-200 bg-orange-500/10 px-2 pr-5 text-[11px] font-semibold text-orange-300 outline-none transition-all hover:border-orange-300 focus:border-orange-300 focus:ring-1 focus:ring-orange-300/30"
                                  value={currentTrueVariant?.id ?? item.productVariantId ?? ''}
                                  disabled={isReadOnly || hasLockedReceiptQuantity(item)}
                                  onChange={(e) =>
                                  updateItemVariant(
                                    item.lineId,
                                    e.target.value === 'base'
                                      ? currentTrueVariant?.id ?? 'base'
                                      : e.target.value,
                                  )
                                }
                                >
                                  {trueVariants.map((variant) => (
                                    <option key={variant.id} value={variant.id}>
                                      {getVariantShortLabel(variant.name) || variant.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  size={11}
                                  className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-orange-300"
                                />
                              </div>
                            ) : null}

                            <StockPopover item={item} branches={branches} />
                          </div>

                          <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                            <span className="truncate font-medium uppercase tracking-wide">
                              {itemCode}
                            </span>
                            {!isReadOnly && duplicateCount > 0 ? (
                              <button
                                type="button"
                                onClick={() => mergeDuplicateItems(item.lineId)}
                                className="shrink-0 font-semibold text-primary-500 transition-colors hover:text-primary-600"
                              >
                                Gộp dòng
                              </button>
                            ) : null}
                            {!isReadOnly && !isEditingNote ? (
                              <button
                                type="button"
                                className="shrink-0 transition-colors hover:text-primary-500"
                                onClick={() => {
                                  setTempNote(item.note)
                                  setEditingNoteForId(item.lineId)
                                }}
                              >
                                {item.note ? 'Có ghi chú' : 'Ghi chú'}
                              </button>
                            ) : null}
                          </div>

                          {/* Inline note */}
                          {isEditingNote ? (
                            <div className="mt-1 flex items-center gap-1">
                              <input
                                type="text"
                                className="h-5 flex-1 rounded border border-border bg-background px-1.5 text-xs text-foreground placeholder:text-foreground-muted outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500/30"
                                placeholder="Nhập ghi chú..."
                                value={tempNote}
                                onChange={(e) => setTempNote(e.target.value)}
                                onBlur={() => {
                                  updateItemNote(item.lineId, tempNote)
                                  setEditingNoteForId(null)
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    updateItemNote(item.lineId, tempNote)
                                    setEditingNoteForId(null)
                                  } else if (e.key === 'Escape') {
                                    setEditingNoteForId(null)
                                  }
                                }}
                                autoFocus
                              />
                              <button
                                type="button"
                                className="text-foreground-muted hover:text-error"
                                onMouseDown={() => {
                                  setTempNote('')
                                  setEditingNoteForId(null)
                                }}
                              >
                                <X size={10} />
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="hidden mt-0.5 text-[11px] text-foreground-muted hover:text-primary-500 transition-colors"
                              onClick={() => {
                                setTempNote(item.note)
                                setEditingNoteForId(item.lineId)
                              }}
                            >
                              {item.note ? (
                                <span className="italic">{item.note}</span>
                              ) : (
                                <span className="opacity-60">Ghi chú...</span>
                              )}
                            </button>
                          )}
                        </div>

                        {/* ĐVT */}
                        <div className="text-center text-xs text-foreground-muted">
                          {conversionVariants.length > 0 ? (
                            <div className="relative inline-flex max-w-full items-center">
                              <select
                                className="h-6 max-w-full appearance-none rounded-md border border-sky-200 bg-sky-500/10 px-2 pr-5 text-center text-[11px] font-semibold text-sky-300 outline-none transition-all hover:border-sky-300 focus:border-sky-300 focus:ring-1 focus:ring-sky-300/30"
                                value={isCurrentConversion ? item.productVariantId ?? 'base' : 'base'}
                                disabled={isReadOnly || hasLockedReceiptQuantity(item)}
                                onChange={(e) =>
                                  updateItemVariant(
                                    item.lineId,
                                    e.target.value === 'base'
                                      ? currentTrueVariant?.id ?? 'base'
                                      : e.target.value,
                                  )
                                }
                              >
                                <option value="base">{item.baseUnit || item.unit || '—'}</option>
                                {conversionVariants.map((variant) => (
                                  <option key={variant.id} value={variant.id}>
                                    {getVariantShortLabel(variant.name) || variant.name}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown
                                size={11}
                                className="pointer-events-none absolute right-1.5 top-1/2 -translate-y-1/2 text-sky-300"
                              />
                            </div>
                          ) : (
                            unitLabel
                          )}
                        </div>

                        {/* Tồn kho (before quantity) */}
                        <div className="text-center">
                          {currentBranchStock !== null && currentBranchStock !== undefined ? (
                            <span
                              className={`text-xs font-semibold tabular-nums ${
                                currentBranchStock <= 0
                                  ? 'text-error'
                                  : currentBranchStock <= 10
                                    ? 'text-warning'
                                    : 'text-foreground-muted'
                              }`}
                            >
                              {currentBranchStock}
                            </span>
                          ) : (
                            <span className="text-xs text-foreground-muted opacity-40">—</span>
                          )}
                        </div>

                        {/* Số lượng */}
                        <div className="flex justify-center">
                          <div className="inline-flex items-center rounded-lg border border-border overflow-hidden">
                            <button
                              type="button"
                              className="flex h-7 w-6 items-center justify-center text-foreground-muted hover:bg-background-secondary disabled:opacity-30 transition-colors"
                              onClick={() => updateItem(item.lineId, 'quantity', item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus size={11} />
                            </button>
                            <input
                              type="number"
                              min={1}
                              className="h-7 w-11 border-x border-border bg-transparent p-0 text-center text-sm font-semibold text-foreground outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                              value={item.quantity}
                              onChange={(e) => updateItem(item.lineId, 'quantity', Number(e.target.value))}
                            />
                            <button
                              type="button"
                              className="flex h-7 w-6 items-center justify-center text-foreground-muted hover:bg-background-secondary transition-colors"
                              onClick={() => updateItem(item.lineId, 'quantity', item.quantity + 1)}
                            >
                              <Plus size={11} />
                            </button>
                          </div>
                        </div>

                        {/* Đơn giá */}
                        <div className="pr-1">
                          <NumericFormat
                            thousandSeparator="."
                            decimalSeparator=","
                            allowNegative={false}
                            className="h-7 w-full rounded-lg border border-border bg-transparent px-2 text-right text-sm font-medium text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                            value={item.unitCost}
                            onValueChange={(values) => updateItem(item.lineId, 'unitCost', values.floatValue || 0)}
                          />
                        </div>

                        {/* Giảm giá */}
                        <div>
                          <NumericFormat
                            thousandSeparator="."
                            decimalSeparator=","
                            allowNegative={false}
                            className="h-7 w-full rounded-lg border border-border bg-transparent px-2 text-right text-sm text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                            value={item.discount || ''}
                            placeholder="0"
                            onValueChange={(values) => updateItem(item.lineId, 'discount', values.floatValue || 0)}
                          />
                        </div>

                        {/* Thành tiền */}
                        <div className="pr-4 text-right">
                          <span className="text-sm font-semibold text-foreground tabular-nums">
                            {fmt(lineAmount)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
