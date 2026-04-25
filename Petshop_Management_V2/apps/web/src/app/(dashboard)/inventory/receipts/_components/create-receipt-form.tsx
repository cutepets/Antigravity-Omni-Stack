'use client'
import { useState } from 'react'
import Image from 'next/image';


import Link from 'next/link'
import dayjs from 'dayjs'
import {
  AlertTriangle,
  ArrowLeft,
  Building2,
  ChevronDown,
  Check,
  Copy,
  FileDown,
  FileSpreadsheet,
  Layers,
  MessageSquare,
  Minus,
  Phone,
  Package2,
  Plus,
  Printer,
  ScanSearch,
  Search,
  Trash2,
  UserPlus,
  X,
  FileUp,
} from 'lucide-react'

import { exportReceiptToExcel } from './receipt/receipt-excel'
import { ReceiptWorkspace } from './receipt-workspace'
import { NumericFormat } from 'react-number-format'
import { normalizeBranchCode, suggestBranchCodeFromName } from '@petshop/shared'
import { customToast as toast } from '@/components/ui/toast-with-copy'

// ─── Modular imports ──────────────────────────────────────────────────────────
import type {
  CreateReceiptFormProps,
  SupplierQuickDraftPayload,
} from './receipt/receipt.types'
import { SUPPLIER_RECEIPT_DRAFT_KEY } from './receipt/receipt.constants'
import {
  fmt,
  getItemIdentity,
  isConversionVariant,
  getTrueVariants,
  getVariantShortLabel,
  getConversionUnitLabel,
  findParentTrueVariant,
  getConversionVariants,
  getVariantSnapshot,
} from './receipt/receipt.utils'
import { StockPopover } from './receipt/stock-popover'
import { QuickSupplierModal } from './receipt/quick-supplier-modal'
import { ReceiptPaymentModal } from './receipt/receipt-payment-modal'
import { ReceiptReturnModal } from './receipt/receipt-return-modal'
import { ReceiptExcelModal } from './receipt/receipt-excel-modal'
import { SelectedItem } from './receipt/receipt.types'
import { useReceiptForm } from './receipt/use-receipt-form'
import { RECEIPT_ITEM_GRID_COLUMNS } from './receipt/receipt-layout'


export function CreateReceiptForm({
  mode = 'create',
  receiptId,
}: CreateReceiptFormProps = {}) {
  const {
    // refs
    searchInputRef, searchPanelRef, supplierPanelRef, exportMenuRef,
    // auth
    user, allowedBranches, isAuthLoading, canAccessScreen, canSubmitReceipt,
    canPayReceipt, canReceiveReceipt, canCancelReceipt, canReturnReceipt,
    canUpdateReceipt,
    isCreateMode, isEditMode, isExistingReceipt,
    // queries
    receipt, isReceiptLoading, branches, suppliers, filteredSuppliers,
    productResults, isSearchingSuggestions, supplierReceipts,
    // state
    branchId, setBranchId,
    supplierId, setSupplierId,
    supplierQuery, setSupplierQuery,
    showSupplierSearch, setShowSupplierSearch,
    showSupplierModal, setShowSupplierModal,
    supplierForm, setSupplierForm,
    supplierCodeTouched, setSupplierCodeTouched,
    notes, setNotes,
    search, setSearch,
    manualSearching,
    isSuggestionOpen, setIsSuggestionOpen,
    highlightedIndex, setHighlightedIndex,
    items, setItems,
    receiptDiscount, setReceiptDiscount,
    receiptTax, setReceiptTax,
    extraCosts,
    showExtraCosts, setShowExtraCosts,
    editingNoteForId, setEditingNoteForId,
    tempNote, setTempNote,
    splitDuplicateLines, setSplitDuplicateLines,
    isEditingSession,
    editSessions,
    showPaymentModal, setShowPaymentModal,
    showReturnModal, setShowReturnModal,
    showExportMenu, setShowExportMenu,
    showReceiptExcelModal, setShowReceiptExcelModal,
    paymentForm, setPaymentForm,
    returnForm, setReturnForm,
    // derived (memoized in hook)
    statusView,
    creatorDisplayName,
    canShowPaymentAction, canShowReceiveAction, canShowCancelAction, canShowReturnAction,
    visibleProgressSteps, enhancedActivityTimelineEntries,
    resolvedReceiptId, isReceiptLocked, isReadOnly,
    isReceiveDone, isCancelled, isCompleted, isFullyPaid,
    hasAnyPayment, hasAnyReceive,
    selectedSupplier, displaySupplier, currentBranch,
    totalQuantity, merchandiseTotal, discountAmount, taxAmount,
    extraCostTotal, grandTotal, normalizedExtraCosts,
    hasPendingReceiptChanges, currentDebt, currentSupplierDebt, maxPayableAmount,
    currentReceiptPaidAmount, currentReceiptTotalAmount, currentReceiptOutstandingAmount,
    orderPaymentAmount, debtSettlementAmount, totalAppliedPaymentAmount, latestPaymentMethodLabel,
    latestPaymentAt, latestReceiveAt, paymentAllocationCount,
    returnableReceiptItems, estimatedRefundAmount,
    // helpers
    getLockedReceiptQuantity, hasLockedReceiptQuantity,
    openPaymentModal, openReturnModal,
    // handlers
    addProductToReceipt, updateItem, updateItemNote, updateItemVariant,
    removeItem,
    duplicateItem, mergeDuplicateItems,
    updateExtraCost, addExtraCost, removeExtraCost,
    resolveProductSearch, handleSearchKeyDown,
    handleOpenQuickSupplier, handleSelectSupplier,
    handleSaveQuickSupplier, handleStartEditing, handleSubmit,
    handleConfirmPayment, handleReturnItemQuantityChange, handleConfirmReturn,
    // mutations
    saveMutation, payMutation, receiveMutation, cancelMutation,
    returnMutation, createSupplierMutation,
  } = useReceiptForm({ mode, receiptId })

  const [discountEditingReceiptId, setDiscountEditingReceiptId] = useState<string | null>(null)
  const [multiSelectMode, setMultiSelectMode] = useState(false)

  if (isAuthLoading || (isExistingReceipt && isReceiptLoading)) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground-muted text-sm">
        Đang kiểm tra quyền truy cập...
      </div>
    )
  }
  if (!canAccessScreen) {
    return (
      <div className="flex h-64 items-center justify-center text-foreground-muted text-sm">
        Đang chuyển hướng...
      </div>
    )
  }
  const handleExcelImport = (importedItems: SelectedItem[]) => {
    setItems((prev) => {
      if (splitDuplicateLines) {
        return [...prev, ...importedItems]
      }

      const newItemsList = [...prev]

      importedItems.forEach((imported) => {
        const importedIdentity = getItemIdentity(imported.productId, imported.productVariantId)
        const existingIdx = newItemsList.findIndex(
          (item) => getItemIdentity(item.productId, item.productVariantId) === importedIdentity,
        )
        if (existingIdx !== -1) {
          const existing = newItemsList[existingIdx]
          newItemsList[existingIdx] = {
            ...existing,
            quantity: Number(existing.quantity ?? 0) + Number(imported.quantity ?? 0),
          }
        } else {
          newItemsList.push(imported)
        }
      })

      return newItemsList
    })
  }

  // Column layout:  del | stt | img | mã  | tên+ghi-chú | đvt | tồn | sl | đgiá | giảm | tiền
  if (isExistingReceipt && !receipt) {
    return (
      <ReceiptWorkspace>
        <div className="flex flex-1 items-center justify-center px-6 text-center text-sm text-error">
          Không tìm thấy phiếu nhập.
        </div>
      </ReceiptWorkspace>
    )
  }

  const cols = RECEIPT_ITEM_GRID_COLUMNS

  // ── Print / Export handlers ───────────────────────────────────────────────────
  const handleDuplicateReceipt = () => {
    if (!supplierId || items.length === 0) {
      toast.error('Đơn nhập cần có nhà cung cấp và ít nhất một sản phẩm để sao chép.')
      return
    }

    const draftPayload: SupplierQuickDraftPayload = {
      supplierId,
      notes,
      items: items.map((item) => ({
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

  const handlePrintReceipt = (type: 'a4' | 'k80' | 'pdf') => {
    const isK80 = type === 'k80'
    const pageWidth = isK80 ? '80mm' : '210mm'
    const supplierName = displaySupplier?.name ?? '—'
    const supplierPhone = displaySupplier?.phone ?? '—'
    const receiptCode = receipt?.receiptNumber ?? receipt?.id ?? resolvedReceiptId ?? '—'
    const createdAt = receipt?.createdAt ? dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm') : '—'
    const branchName = currentBranch?.name ?? '—'
    const statusLabel = statusView.label

    const rowsHtml = items
      .map(
        (item, idx) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${item.name}${(item.variantLabel ?? item.variantName) ? ` (${item.variantLabel ?? item.variantName})` : ''}${item.sku ? `<br><small style="color:#999">${item.sku}</small>` : ''}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unitLabel ?? item.baseUnit ?? item.unit ?? '—'}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.quantity}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unitCost.toLocaleString('vi-VN')}</td>
          ${item.discount > 0 ? `<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.discount.toLocaleString('vi-VN')}</td>` : `<td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">—</td>`}
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">${(item.quantity * item.unitCost).toLocaleString('vi-VN')}</td>
        </tr>`,
      )
      .join('')

    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8"/>
  <title>Phiếu nhập ${receiptCode}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Arial, sans-serif; font-size: ${isK80 ? '10px' : '12px'}; color: #111; width: ${pageWidth}; margin: 0 auto; padding: ${isK80 ? '8px' : '20px'}; }
    h1 { font-size: ${isK80 ? '13px' : '18px'}; font-weight: 700; margin-bottom: 4px; }
    .meta { font-size: ${isK80 ? '9px' : '11px'}; color: #666; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    .meta span { margin-right: 12px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: ${isK80 ? '8px' : '16px'}; font-size: ${isK80 ? '9px' : '11px'}; }
    .info-block label { display: block; color: #888; margin-bottom: 2px; }
    .info-block span { font-weight: 600; }
    table { width: 100%; border-collapse: collapse; margin-bottom: ${isK80 ? '8px' : '16px'}; }
    thead th { background: #f5f5f5; padding: 5px 6px; text-align: left; font-size: ${isK80 ? '9px' : '11px'}; border-bottom: 2px solid #ddd; }
    thead th:nth-child(n+3) { text-align: right; }
    .totals { margin-left: auto; width: ${isK80 ? '100%' : '260px'}; font-size: ${isK80 ? '10px' : '12px'}; }
    .totals tr td { padding: 3px 6px; }
    .totals tr td:last-child { text-align: right; }
    .totals .grand td { font-size: ${isK80 ? '12px' : '15px'}; font-weight: 700; padding-top: 8px; border-top: 2px solid #111; }
    .status-badge { display: inline-block; padding: 2px 10px; border-radius: 20px; font-size: ${isK80 ? '9px' : '11px'}; font-weight: 600; background: #eff6ff; color: #2563eb; margin-bottom: ${isK80 ? '6px' : '10px'}; }
    .footer { margin-top: ${isK80 ? '10px' : '24px'}; font-size: ${isK80 ? '9px' : '11px'}; color: #999; border-top: 1px dashed #ddd; padding-top: 8px; text-align: center; }
    @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
  </style>
</head>
<body>
  <h1>PHIẾU NHẬP HÀNG</h1>
    <span>Mã: <strong>${receiptCode}</strong></span>
    <span>Ngày: ${createdAt}</span>
    <span>Chi nhánh: ${branchName}</span>
  </div>
  <div class="status-badge">${statusLabel}</div>
  <div class="info-grid">
    <div class="info-block">
      <label>Nhà cung cấp</label>
      <span>${supplierName}</span>
    </div>
    <div class="info-block">
      <label>Điện thoại NCC</label>
      <span>${supplierPhone}</span>
    </div>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Sản phẩm</th>
        <th>ĐVT</th>
        <th>SL</th>
        <th>Đơn giá</th>
        <th>Giảm giá</th>
        <th>Thành tiền</th>
      </tr>
    </thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  <table class="totals">
    <tr><td>Tổng hàng hóa</td><td>${merchandiseTotal.toLocaleString('vi-VN')} đ</td></tr>
    ${receiptDiscount > 0 ? `<tr><td>Giảm giá</td><td>-${discountAmount.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    ${receiptTax > 0 ? `<tr><td>Thuế</td><td>+${taxAmount.toLocaleString('vi-VN')} đ</td></tr>` : ''}
    <tr class="grand"><td>Cần trả NCC</td><td>${grandTotal.toLocaleString('vi-VN')} đ</td></tr>
    ${currentDebt > 0 ? `<tr><td>Còn nợ</td><td style="color:#e11d48">${currentDebt.toLocaleString('vi-VN')} đ</td></tr>` : ''}
  </table>
  ${notes ? `<div style="margin-top:8px;font-size:${isK80 ? '9px' : '11px'};color:#555;">Ghi chú: ${notes}</div>` : ''}
  <div class="footer">In lúc ${dayjs().format('DD/MM/YYYY HH:mm')} • Phần mềm Petshop</div>
</body>
</html>`

    const win = window.open('', '_blank', `width=800,height=700`)
    if (!win) {
      toast.error('Trình duyệt chặn popup. Vui lòng cho phép popup để in/xuất.')
      return
    }
    win.document.write(html)
    win.document.close()
    win.onload = () => {
      win.focus()
      win.print()
    }
  }

  const handleExportExcel = async () => {
    const receiptCode = receipt?.receiptNumber ?? receipt?.id ?? resolvedReceiptId ?? 'phieu-nhap'
    const fileName = await exportReceiptToExcel({
      receiptCode,
      supplierName: displaySupplier?.name ?? '',
      createdAt: receipt?.createdAt,
      branchName: currentBranch?.name ?? '',
      statusLabel: statusView.label,
      items,
      merchandiseTotal,
      receiptDiscount,
      discountAmount,
      receiptTax,
      taxAmount,
      grandTotal,
      currentDebt,
    })
    toast.success(`Đã xuất file ${fileName}`)
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <ReceiptWorkspace>
      <QuickSupplierModal
        isOpen={showSupplierModal}
        form={supplierForm}
        isSaving={createSupplierMutation.isPending}
        onClose={() => {
          setShowSupplierModal(false)
          setSupplierCodeTouched(false)
        }}
        onChange={(field, value) =>
          setSupplierForm((current) => {
            if (field === 'name') {
              return {
                ...current,
                name: value,
                code: supplierCodeTouched ? current.code : suggestBranchCodeFromName(value),
              }
            }

            if (field === 'code') {
              setSupplierCodeTouched(true)
              return {
                ...current,
                code: normalizeBranchCode(value),
              }
            }

            return { ...current, [field]: value }
          })
        }
        onSave={handleSaveQuickSupplier}
      />
      <ReceiptPaymentModal
        isOpen={showPaymentModal}
        form={paymentForm}
        debtAmount={currentSupplierDebt}
        supplierDebtAmount={maxPayableAmount}
        orderAmount={currentReceiptOutstandingAmount}
        isPending={payMutation.isPending}
        onClose={() => {
          if (payMutation.isPending) return
          setShowPaymentModal(false)
        }}
        onChange={(field, value) =>
          setPaymentForm((current) => ({
            ...current,
            [field]: value,
          }))
        }
        onConfirm={handleConfirmPayment}
      />
      <ReceiptReturnModal
        isOpen={showReturnModal}
        form={returnForm}
        estimatedRefundAmount={estimatedRefundAmount}
        isPending={returnMutation.isPending}
        onClose={() => {
          if (returnMutation.isPending) return
          setShowReturnModal(false)
        }}
        onChangeNotes={(value) =>
          setReturnForm((current) => ({
            ...current,
            notes: value,
          }))
        }
        onChangeQuantity={handleReturnItemQuantityChange}
        onChangeSettlementMode={(value) =>
          setReturnForm((current) => ({
            ...current,
            settlementMode: value,
          }))
        }
        onChangeRefundPaymentMethod={(value) =>
          setReturnForm((current) => ({
            ...current,
            refundPaymentMethod: value,
          }))
        }
        onConfirm={handleConfirmReturn}
      />
      <ReceiptExcelModal
        isOpen={showReceiptExcelModal}
        onClose={() => setShowReceiptExcelModal(false)}
        onImported={handleExcelImport}
      />
      <div className="shrink-0 border-b border-border bg-[linear-gradient(135deg,rgba(14,165,233,0.08),rgba(255,255,255,0))]">
        <div className="grid gap-2.5 px-5 py-3 xl:grid-cols-[minmax(240px,0.68fr)_minmax(420px,1.04fr)_minmax(392px,0.94fr)_minmax(176px,0.38fr)]">
          <div className="flex items-start gap-3">
            <Link
              href="/inventory/receipts"
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border border-border bg-background text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            >
              <ArrowLeft size={18} />
            </Link>
            <div className="min-w-0">
              <div className="text-lg font-semibold text-foreground">
                {isEditMode ? 'Cập nhật phiếu nhập' : 'Tạo phiếu nhập'}
              </div>

              <div className="mt-2 flex flex-wrap items-start gap-2.5">
                <div ref={supplierPanelRef} className="relative min-w-[200px] flex-1">
                  {displaySupplier ? (
                    <div className="flex h-10 items-center justify-between rounded-xl border border-border bg-background px-3">
                      <a
                        href={displaySupplier.code ? `/inventory/suppliers/${displaySupplier.code}` : undefined}
                        target="_blank"
                        rel="noreferrer"
                        className="group min-w-0 hover:opacity-80 transition-opacity cursor-pointer"
                        onClick={(e) => {
                          if (!displaySupplier.code) e.preventDefault()
                        }}
                      >
                        <div className="truncate text-sm font-semibold text-foreground group-hover:text-primary-500 transition-colors">
                          {displaySupplier.name}
                        </div>
                      </a>
                      {!isReadOnly ? (
                        <button
                          type="button"
                          onClick={() => {
                            setSupplierId('')
                            setSupplierQuery('')
                          }}
                          className="ml-3 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-error/10 hover:text-error"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <Building2
                        size={14}
                        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                      />
                      <input
                        type="text"
                        className="h-10 w-full rounded-xl border border-border bg-background pl-9 pr-10 text-sm text-foreground placeholder:text-foreground-muted outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                        placeholder="Tìm nhà cung cấp"
                        value={supplierQuery}
                        onChange={(e) => {
                          setSupplierQuery(e.target.value)
                          setShowSupplierSearch(true)
                        }}
                        onFocus={() => setShowSupplierSearch(true)}
                        disabled={isReadOnly}
                      />
                      <button
                        type="button"
                        onClick={handleOpenQuickSupplier}
                        className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-background-secondary hover:text-primary-500"
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
                    </>
                  )}
                </div>




              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                  {displaySupplier?.phone || 'Chưa có SĐT nhà cung cấp'}
                </span>
                <span className="rounded-full border border-border bg-background px-3 py-1 text-xs text-foreground-muted">
                  {displaySupplier?.code || 'Mã NCC: Tự động'}
                </span>
                {currentSupplierDebt > 0 ? (
                  <span className="rounded-full border border-warning/20 bg-warning/10 px-3 py-1 text-xs font-semibold text-warning">
                    Tổng nợ: {fmt(currentSupplierDebt)}
                  </span>
                ) : null}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/80 px-4 py-2.5 flex flex-col justify-center">
            <div className="grid gap-2.5 md:grid-cols-[minmax(0,1fr)_220px]">
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Mã đơn nhập:
                  </span>
                  <span className="font-semibold text-foreground">
                    {receipt?.receiptNumber || 'Tự động tạo khi lưu phiếu'}
                  </span>
                  <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-widest ${statusView.toneClass}`}>
                    {statusView.label}
                  </span>
                </div>
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Nhân viên:
                  </span>
                  <span className="font-semibold text-foreground">
                    {creatorDisplayName}
                  </span>
                </div>
              </div>
              <div className="rounded-xl border border-border bg-background px-3 py-2.5">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Chi nhánh nhận hàng
                </div>
                <select
                  className="mt-1.5 h-10 w-full rounded-xl border border-border bg-background-secondary px-3 text-sm text-foreground outline-none transition-all focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20"
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                  disabled={isReadOnly}
                >
                  <option value="">Chọn chi nhánh nhận hàng</option>
                  {allowedBranches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>

              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-background/80 px-5 py-3">
            <div className="hidden mb-2 items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
              <span>Tiến trình đơn nhập</span>
              <span>Giai đoạn 1/4</span>
            </div>
            <div className="flex w-full items-start justify-between">
              {visibleProgressSteps.map((step, index) => (
                <div
                  key={`${step.title}-${index}`}
                  className="relative flex flex-1 min-w-0 flex-col items-center justify-start gap-1 py-1 text-center"
                >
                  <div className="relative flex w-full justify-center px-1">
                    <div
                      className={`relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${step.state === 'alert'
                        ? 'border-rose-500/50 bg-rose-500/12 text-rose-300'
                        : step.state === 'completed' || step.state === 'active'
                          ? 'border-primary-500/50 bg-primary-500/10 text-primary-500'
                          : 'border-border bg-background text-foreground-muted'
                        }`}
                    >
                      {index + 1}
                    </div>
                    {index < visibleProgressSteps.length - 1 ? (
                      <div
                        className={`absolute top-1/2 h-px -translate-y-1/2 ${visibleProgressSteps[index + 1]?.state === 'alert'
                          ? 'bg-rose-500/35'
                          : step.state === 'completed'
                            ? 'bg-primary-500/50'
                            : 'bg-border'
                          }`}
                        style={{ left: 'calc(50% + 16px)', right: 'calc(-50% + 16px)' }}
                      />
                    ) : null}
                  </div>
                  <div className="mt-0.5 flex min-h-[40px] flex-col items-center justify-start space-y-0.5">
                    <div className={`text-[12px] font-semibold leading-4 ${step.state === 'alert' ? 'text-rose-300' : 'text-foreground'}`}>{step.title}</div>
                    <div className={`whitespace-nowrap text-[10px] leading-3.5 ${step.state === 'alert' ? 'text-rose-200/85' : 'text-foreground-muted'}`}>{step.meta}</div>
                  </div>
                </div>
              ))}
            </div>

          </div>

          <div className="flex min-w-[176px] flex-col gap-1.5 xl:items-end xl:justify-center">

            <div className="flex flex-col gap-1.5 xl:items-end">
              {isCreateMode ? (
                <button
                  type="button"
                  onClick={() => handleSubmit('draft')}
                  disabled={saveMutation.isPending || items.length === 0 || !branchId}
                  className="btn-primary min-w-[176px] justify-center rounded-xl py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saveMutation.isPending ? 'Đang xử lý...' : 'Tạo đơn nhập'}
                </button>
              ) : null}
              {canShowPaymentAction ? (
                <button
                  type="button"
                  onClick={openPaymentModal}
                  disabled={
                    payMutation.isPending ||
                    !resolvedReceiptId ||
                    maxPayableAmount <= 0 ||
                    receipt?.status === 'CANCELLED'
                  }
                  className="btn-primary min-w-[176px] justify-center rounded-xl py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {payMutation.isPending ? 'Đang xử lý...' : 'Thanh toán'}
                </button>
              ) : null}
              {canShowReceiveAction ? (
                <button
                  type="button"
                  onClick={() => receiveMutation.mutate()}
                  disabled={receiveMutation.isPending || !resolvedReceiptId}
                  className="btn-primary min-w-[176px] justify-center rounded-xl py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {receiveMutation.isPending ? 'Đang xử lý...' : 'Nhập kho'}
                </button>
              ) : null}
              {canShowCancelAction ? (
                <button
                  type="button"
                  onClick={() => cancelMutation.mutate()}
                  disabled={cancelMutation.isPending || !resolvedReceiptId}
                  className="btn-outline min-w-[176px] justify-center rounded-xl border-error/40 py-2 text-sm text-error disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {cancelMutation.isPending ? 'Đang xử lý...' : 'Hủy phiếu'}
                </button>
              ) : null}
              {canShowReturnAction ? (
                <button
                  type="button"
                  onClick={openReturnModal}
                  disabled={returnMutation.isPending || !resolvedReceiptId}
                  className="inline-flex min-w-[176px] items-center justify-center rounded-xl border border-amber-500/40 bg-amber-500/12 px-4 py-2 text-sm font-semibold text-amber-300 transition-colors hover:border-amber-500/60 hover:bg-amber-500/18 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {returnMutation.isPending ? 'Đang xử lý...' : 'Hoàn trả'}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      {/* ── SEARCH BAR + MAIN BODY IN ONE BLOCK ───────────────────────────── */}
      <div className="m-4 mt-2 mb-4 flex flex-1 flex-col overflow-hidden rounded-[26px] border border-border bg-background-secondary/35 shadow-sm">

        {/* ─── TOP BAR ─────────────────────────────────────────────────────────── */}
        <div className="flex shrink-0 items-center gap-3 border-b border-border/60 bg-background/50 px-4 py-2.5">
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
                {multiSelectMode && (
                  <div className="flex items-center justify-between border-b border-border bg-primary-500/6 px-3 py-1.5">
                    <span className="text-[11px] font-semibold text-primary-500">
                      Chế độ chọn nhiều — click để thêm/gộp vào đơn
                    </span>
                    <span className="text-[11px] text-foreground-muted">{items.length} dòng</span>
                  </div>
                )}
                <div className="max-h-72 overflow-y-auto custom-scrollbar">
                  {productResults.map((product: any, index: number) => {
                    const selectableVariants = (() => {
                      const trueVariants = getTrueVariants(product.variants)
                      if (trueVariants.length > 0) return trueVariants
                      return Array.isArray(product.variants) ? product.variants : []
                    })()
                    const isProductInItems = items.some((item) => item.productId === product.id)

                    return (
                      <div
                        key={product.id}
                        className={`border-b border-border px-3 py-2.5 text-sm last:border-0 transition-colors ${index === highlightedIndex
                          ? 'bg-primary-500/10'
                          : multiSelectMode && isProductInItems
                            ? 'bg-primary-500/5'
                            : 'hover:bg-background-secondary'
                          }`}
                      >
                        <button
                          type="button"
                          className="flex w-full items-center gap-3 text-left"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            if (multiSelectMode) {
                              const savedSearch = search
                              addProductToReceipt(product)
                              window.setTimeout(() => {
                                setSearch(savedSearch)
                                setIsSuggestionOpen(true)
                              }, 0)
                            } else {
                              addProductToReceipt(product)
                            }
                          }}
                        >
                          {multiSelectMode && (
                            <div className={`flex h-4.5 w-4.5 shrink-0 items-center justify-center rounded border transition-colors ${isProductInItems
                              ? 'border-primary-500 bg-primary-500'
                              : 'border-border bg-background'
                              }`}>
                              {isProductInItems && <Check size={10} className="text-white" />}
                            </div>
                          )}
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-background-tertiary">
                            {product.image ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <Image src={product.image}
                                alt={product.name}
                                className="h-full w-full object-cover" width={400} height={400} unoptimized />
                            ) : (
                              <Package2 size={14} className="text-foreground-muted" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className={`truncate font-medium ${multiSelectMode && isProductInItems ? 'text-primary-600' : 'text-foreground'
                              }`}>{product.name}</div>
                            <div className="mt-0.5 text-[11px] text-foreground-muted">
                              {product.sku || product.barcode || '?'}
                              {product.stock !== undefined && (
                                <span className="ml-2 font-medium text-primary-500">
                                  {'T\u1ed3n:'} {product.stock}
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

                        {selectableVariants.length > 1 && (
                          <div className="mt-2 flex flex-wrap gap-2 pl-12">
                            {selectableVariants.map((variant: any) => {
                              const isVariantInItems = items.some(
                                (item) => item.productId === product.id && item.productVariantId === variant.id
                              )
                              return (
                                <button
                                  key={variant.id}
                                  type="button"
                                  className={`inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-[11px] font-medium transition-colors ${multiSelectMode && isVariantInItems
                                    ? 'border-primary-500/60 bg-primary-500/10 text-primary-500'
                                    : 'border-border bg-background-secondary text-foreground hover:border-primary-500/40 hover:text-primary-500'
                                    }`}
                                  onMouseDown={(e) => e.preventDefault()}
                                  onClick={() => {
                                    if (multiSelectMode) {
                                      const savedSearch = search
                                      addProductToReceipt(product, { productVariantId: variant.id })
                                      window.setTimeout(() => {
                                        setSearch(savedSearch)
                                        setIsSuggestionOpen(true)
                                      }, 0)
                                    } else {
                                      addProductToReceipt(product, { productVariantId: variant.id })
                                    }
                                  }}
                                >
                                  {multiSelectMode && isVariantInItems && <Check size={9} className="text-primary-500" />}
                                  <span>{variant.unitLabel || variant.variantLabel || getVariantShortLabel(variant.name, product.name) || variant.name}</span>
                                </button>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
          {/* Multi-select toggle */}
          {!isReadOnly && (
            <button
              type="button"
              onClick={() => {
                setMultiSelectMode((v) => !v)
                window.setTimeout(() => searchInputRef.current?.focus(), 10)
              }}
              aria-pressed={multiSelectMode}
              aria-label="Chọn nhiều sản phẩm cùng lúc"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${multiSelectMode
                ? 'border-primary-500 bg-primary-500/10 text-primary-500 shadow-[0_0_0_2px_rgba(16,185,129,0.15)]'
                : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground'
                }`}
              title={multiSelectMode ? 'Đang bật chọn nhiều (click để tắt)' : 'Bật chọn nhiều sản phẩm cùng lúc'}
            >
              <Layers size={14} />
            </button>
          )}

          <button
            type="button"
            onClick={() => {
              setSplitDuplicateLines((current) => !current)
              window.setTimeout(() => searchInputRef.current?.focus(), 10)
            }}
            aria-pressed={splitDuplicateLines}
            aria-label="Tách dòng sản phẩm trùng"
            className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border transition-all ${splitDuplicateLines
              ? 'border-primary-500 bg-primary-500/10 text-primary-500'
              : 'border-border bg-background-secondary text-foreground-muted hover:text-foreground'
              }`}
            title={splitDuplicateLines ? 'Đang bật tách dòng sản phẩm trùng' : 'Đang tự gộp sản phẩm trùng vào cùng một dòng'}
          >
            <FileSpreadsheet size={14} />
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

          {resolvedReceiptId ? (
            <div ref={exportMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setShowExportMenu((v) => !v)}
                className="inline-flex h-9 items-center gap-2 rounded-lg border border-border bg-background-secondary px-3 text-sm font-semibold text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <Printer size={15} />
                In / Xuất đơn
                <ChevronDown size={13} className={`transition-transform duration-200 ${showExportMenu ? 'rotate-180' : ''}`} />
              </button>

              {showExportMenu && (
                <div className="absolute left-0 top-full z-50 mt-1.5 w-52 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Thao tác Excel</div>
                  <button
                    type="button"
                    onClick={() => setShowReceiptExcelModal(true)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <FileUp size={14} className="text-foreground-muted" />
                    Nhập từ Excel
                  </button>
                  <div className="my-1 h-px bg-border" />
                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">In phiếu</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false)
                      handlePrintReceipt('a4')
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={14} className="text-foreground-muted" />
                    In khổ A4
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false)
                      handlePrintReceipt('k80')
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={14} className="text-foreground-muted" />
                    In khổ K80 (nhiệt)
                  </button>

                  <div className="mx-3 my-1 border-t border-border" />

                  <div className="px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-foreground-muted">Xuất đơn</div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false)
                      handlePrintReceipt('pdf')
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <FileDown size={14} className="text-foreground-muted" />
                    Xuất PDF
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowExportMenu(false)
                      handleExportExcel()
                    }}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <FileSpreadsheet size={14} className="text-foreground-muted" />
                    Xuất Excel (.xlsx)
                  </button>
                </div>
              )}
            </div>
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
              className={`inline-flex h-9 items-center justify-center rounded-lg px-3 text-sm font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50 ${isEditingSession
                ? 'bg-primary-500 text-white shadow-[0_10px_30px_rgba(16,185,129,0.25)]'
                : 'border border-border bg-background-secondary text-foreground hover:border-primary-500/30 hover:text-primary-500'
                }`}
            >
              {isEditingSession ? (saveMutation.isPending ? 'Đang lưu...' : 'Lưu cập nhật') : 'Cập nhật'}
            </button>
          ) : null}


        </div>

        {/* ─── MAIN CONTENT ──────────────────────────────────────────────────────── */}
        <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_420px]">
          {/* ── LEFT: Product Table ─────────────────────────────────────────────── */}

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {/* Table header */}
            <div className="shrink-0 border-b border-border bg-background-secondary/60">
              <div
                className="grid items-center px-0 py-2.5 text-xs font-semibold uppercase tracking-wide text-foreground-muted"
                style={{ gridTemplateColumns: cols }}
              >
                <div className="text-center">Xóa</div>
                <div className="text-center">STT</div>
                <div className="text-center">Ảnh</div>
                <div className="pl-1">Mã hàng</div>
                <div>Tên hàng</div>
                <div className="text-center">ĐVT</div>
                <div className="text-center">Tồn kho</div>
                <div className="text-center">{'Hi\u1ec7u xu\u1ea5t b\u00e1n'}</div>
                <div className="text-center">Số lượng</div>
                <div className="pr-3 text-right">Đơn giá</div>
                <div className="pr-5 text-right">Thành tiền</div>
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
                  <button
                    onClick={() => setShowReceiptExcelModal(true)}
                    className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-primary-500 hover:text-primary-600 transition-colors bg-primary-500/10 hover:bg-primary-500/15 px-3 py-1.5 rounded-lg"
                  >
                    <FileUp size={14} /> Hoặc nhập từ Excel
                  </button>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item, idx) => {
                    const lineAmount = item.quantity * item.unitCost - item.discount
                    const isEditingNote = editingNoteForId === item.lineId
                    const variants = item.variants ?? []
                    const trueVariants = getTrueVariants(variants)
                    const snapshot = getVariantSnapshot(item)
                    const currentVariant = snapshot.selectedVariant
                    const isCurrentConversion = isConversionVariant(currentVariant)
                    const currentTrueVariant = currentVariant
                      ? findParentTrueVariant(variants, currentVariant, item.name)
                      : (trueVariants[0] ?? null)
                    const conversionVariants = getConversionVariants(variants, currentTrueVariant, item.name)
                    const itemCode = snapshot.displaySku || snapshot.displayBarcode || '—'
                    const itemBarcode = snapshot.displayBarcode || '—'
                    const currentMonthlySellThrough =
                      snapshot.selectedVariant?.monthlySellThrough ??
                      item.baseMonthlySellThrough ??
                      item.monthlySellThrough ??
                      null
                    const unitLabel =
                      currentVariant && isConversionVariant(currentVariant)
                        ? getConversionUnitLabel(currentVariant, item.name, currentTrueVariant) || item.baseUnit || item.unit || '—'
                        : item.baseUnit || item.unit || '—'

                    const itemIdentity = getItemIdentity(item.productId, item.productVariantId)
                    const duplicateCount = items.filter(
                      (candidate) =>
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
                          {/* Xóa */}
                          <div className="flex justify-center">
                            <button
                              type="button"
                              onClick={() => removeItem(item.lineId)}
                              disabled={isReadOnly}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-foreground-muted transition-colors hover:bg-error/10 hover:text-error disabled:cursor-not-allowed disabled:opacity-30"
                              title="Xóa khỏi giỏ hàng"
                              aria-label="Xóa khỏi giỏ hàng"
                            >
                              <Trash2 size={14} />
                            </button>
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
                                <Image src={item.image}
                                  alt={snapshot.displayName}
                                  className="h-full w-full object-cover" width={400} height={400} unoptimized />
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
                            {/* Product name row */}
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span
                                className="truncate text-sm font-medium text-foreground"
                                title={snapshot.displayName}
                              >
                                {item.name}
                              </span>

                              {trueVariants.length > 1 ? (
                                <div className="relative inline-flex items-center shrink-0 group cursor-pointer -ml-1">
                                  <select
                                    className="appearance-none bg-transparent text-primary-500 text-[13px] font-semibold pr-4 pl-1 outline-none cursor-pointer hover:text-primary-600 transition-colors leading-normal"
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
                                        {variant.variantLabel || getVariantShortLabel(variant.name, item.name) || variant.name}
                                      </option>
                                    ))}
                                  </select>
                                  <ChevronDown
                                    className="absolute right-0 top-1/2 -translate-y-1/2 text-primary-500/50 group-hover:text-primary-600 pointer-events-none transition-colors"
                                    size={11}
                                  />
                                </div>
                              ) : null}

                              {/* Stock info popup – identical mechanism to POS */}
                              <StockPopover item={item} branches={branches} />
                            </div>

                            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-foreground-muted">
                              <span className="truncate font-medium uppercase tracking-wide">
                                {itemBarcode}
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
                                  className={`shrink-0 transition-colors ${item.note ? 'text-amber-400 hover:text-amber-500' : 'text-foreground-muted/40 hover:text-foreground-muted'}`}
                                  title={item.note || 'Thêm ghi chú'}
                                  onClick={() => {
                                    setTempNote(item.note)
                                    setEditingNoteForId(item.lineId)
                                  }}
                                >
                                  <MessageSquare size={12} />
                                </button>
                              ) : null}
                              {!isReadOnly && !isEditingNote && item.note ? (
                                <span
                                  className="truncate text-amber-400 cursor-pointer hover:text-amber-500 transition-colors"
                                  onClick={() => {
                                    setTempNote(item.note)
                                    setEditingNoteForId(item.lineId)
                                  }}
                                >
                                  {item.note}
                                </span>
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
                            ) : null}


                          </div>

                          {/* ĐVT */}
                          <div className="text-center">
                            {conversionVariants.length > 0 ? (
                              <div className={`relative inline-flex items-center group cursor-pointer transition-colors ${isCurrentConversion ? 'text-primary-500' : 'text-foreground-muted hover:text-primary-500'}`}>
                                <select
                                  className={`appearance-none bg-transparent text-sm font-medium outline-none cursor-pointer pr-4 w-full text-center transition-colors ${isCurrentConversion ? 'text-primary-500 font-semibold' : 'text-foreground-muted hover:text-primary-500'}`}
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
                                      {getConversionUnitLabel(variant, item.name, currentTrueVariant) || variant.name}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown
                                  className={`absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none transition-colors ${isCurrentConversion ? 'opacity-80 text-primary-500' : 'opacity-50 group-hover:opacity-100'}`} size={11}
                                />
                              </div>
                            ) : (
                              <span className="text-sm text-foreground-muted">{unitLabel}</span>
                            )}
                          </div>

                          {/* Tồn kho (before quantity) */}
                          <div className="text-center">
                            {currentBranchStock !== null && currentBranchStock !== undefined ? (
                              <span
                                className={`text-xs font-semibold tabular-nums ${currentBranchStock <= 0
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

                          <div className="text-center">
                            {currentMonthlySellThrough != null ? (
                              <span className="text-xs font-semibold tabular-nums text-foreground">
                                {Math.round(currentMonthlySellThrough).toLocaleString('vi-VN')}
                              </span>
                            ) : (
                              <span className="text-xs text-foreground-muted opacity-40">-</span>
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
                                data-quantity-input={idx}
                                className="h-7 w-11 border-x border-border bg-transparent p-0 text-center text-sm font-semibold text-foreground outline-none focus:ring-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                value={item.quantity}
                                onChange={(e) => updateItem(item.lineId, 'quantity', Number(e.target.value))}
                                onKeyDown={(e) => {
                                  if (e.key === 'ArrowUp') {
                                    e.preventDefault()
                                    if (idx > 0) {
                                      const prev = document.querySelector(`[data-quantity-input="${idx - 1}"]`) as HTMLInputElement
                                      prev?.focus()
                                    }
                                  } else if (e.key === 'ArrowDown') {
                                    e.preventDefault()
                                    if (idx < items.length - 1) {
                                      const next = document.querySelector(`[data-quantity-input="${idx + 1}"]`) as HTMLInputElement
                                      next?.focus()
                                    }
                                  } else if (e.key === 'ArrowLeft') {
                                    e.preventDefault()
                                    if (item.quantity > 1) {
                                      updateItem(item.lineId, 'quantity', item.quantity - 1)
                                    }
                                  } else if (e.key === 'ArrowRight') {
                                    e.preventDefault()
                                    updateItem(item.lineId, 'quantity', item.quantity + 1)
                                  }
                                }}
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
                          <div className="relative pr-4">
                            {
                              discountEditingReceiptId === item.lineId ? (
                                <>
                                  <div className="fixed inset-0 z-40 cursor-default" onClick={() => setDiscountEditingReceiptId(null)} />
                                  <div className="absolute right-0 z-50 mt-1 w-72 rounded-xl border border-border bg-background p-4 shadow-2xl shadow-black/20 animate-in fade-in zoom-in-95 duration-150">
                                    <div className="flex items-center justify-between border-b border-border pb-2 mb-3">
                                      <h4 className="font-bold text-foreground text-sm">Giá &amp; Chiết khấu</h4>
                                      <button className="text-foreground-muted hover:text-foreground transition-colors" onClick={() => setDiscountEditingReceiptId(null)}><X size={16} /></button>
                                    </div>
                                    <div className="space-y-3">
                                      <div>
                                        <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted mb-1">Đơn giá (VNĐ)</label>
                                        <NumericFormat
                                          thousandSeparator="."
                                          decimalSeparator=","
                                          allowNegative={false}
                                          className="h-8 w-full rounded-lg border border-border bg-background-secondary px-2.5 text-right text-sm font-medium text-foreground outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-500/20 transition-all"
                                          value={item.unitCost}
                                          onValueChange={(values) => updateItem(item.lineId, 'unitCost', values.floatValue || 0)}
                                          autoFocus
                                        />
                                      </div>
                                      <div className="grid grid-cols-2 gap-2">
                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted mb-1">CK (VNĐ)</label>
                                          <div className="relative">
                                            <NumericFormat
                                              thousandSeparator="."
                                              decimalSeparator=","
                                              allowNegative={false}
                                              className="h-8 w-full rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 pr-6 text-right text-sm font-medium text-amber-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-amber-500/40"
                                              value={item.discount || ''}
                                              placeholder="0"
                                              onValueChange={(values) => updateItem(item.lineId, 'discount', values.floatValue || 0)}
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-amber-500 select-none">đ</span>
                                          </div>
                                        </div>
                                        <div>
                                          <label className="block text-[11px] font-semibold uppercase tracking-[0.14em] text-foreground-muted mb-1">CK (%)</label>
                                          <div className="relative">
                                            <input
                                              type="text"
                                              className="h-8 w-full rounded-lg border border-amber-500/30 bg-amber-500/8 px-2.5 pr-6 text-right text-sm font-medium text-amber-400 outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500/20 transition-all placeholder:text-amber-500/40"
                                              placeholder="0"
                                              value={item.discount > 0 && item.unitCost > 0 ? Math.round((item.discount / item.unitCost) * 100) : ''}
                                              onChange={(e) => {
                                                const pct = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                                                const val = isNaN(pct) ? 0 : Math.round(item.unitCost * Math.min(100, Math.max(0, pct)) / 100);
                                                updateItem(item.lineId, 'discount', val);
                                              }}
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[11px] font-medium text-amber-500 select-none">%</span>
                                          </div>
                                        </div>
                                      </div>
                                      {(item.discount ?? 0) > 0 && (
                                        <div className="pt-2 border-t border-border flex justify-between items-center text-xs">
                                          <span className="text-foreground-muted">Giảm giá:</span>
                                          <span className="font-bold text-amber-400">-{item.discount.toLocaleString('vi-VN')}đ ({Math.round((item.discount / item.unitCost) * 100)}%)</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </>
                              ) : null
                            }
                            <div
                              className="group/price relative cursor-pointer flex flex-col items-end"
                              onClick={() => !isReadOnly && setDiscountEditingReceiptId(item.lineId)}
                            >
                              <div className={`text-sm font-medium text-foreground border-b border-dashed transition-colors pb-0.5 text-right ${isReadOnly ? 'border-transparent cursor-default' : 'border-border hover:border-primary-500 group-hover/price:border-primary-500'}`}>
                                {(item.unitCost).toLocaleString('vi-VN')}
                              </div>
                              {(item.discount ?? 0) > 0 && (
                                <div className="flex items-center gap-1 mt-0.5 text-[10px] font-semibold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                                  <span>-{Math.round((item.discount / item.unitCost) * 100)}%</span>
                                  <span className="opacity-70">(-{item.discount.toLocaleString('vi-VN')}đ)</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Thành tiền */}
                          <div className="pl-3 pr-5 text-right">
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

          {/* ── RIGHT SIDEBAR ──────────────────────────────────────────────────── */}
          <div className="flex min-h-0 w-[420px] shrink-0 flex-col overflow-hidden border-l border-border bg-background">




            {/* Totals */}
            <div className="border-b border-border px-3 py-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-sm text-foreground-muted flex items-center gap-1.5">
                  Tổng tiền hàng ({totalQuantity})
                  {totalQuantity > 0 && (
                    <span className="badge badge-primary text-[10px] px-1.5 py-0">
                      {totalQuantity}
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

              <div className="flex items-center justify-between rounded-xl border border-border bg-background-secondary px-3 py-2.5">
                <span className="text-sm font-semibold text-foreground">Cần trả NCC</span>
                <span className="text-base font-black text-primary-500 tabular-nums">
                  {fmt(grandTotal)}
                </span>
              </div>
            </div>

            {/* Payment info */}
            <div className="border-b border-border px-3 py-2.5 space-y-2">
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
              <div className="rounded-xl border border-border bg-background-secondary px-3 py-2.5">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs text-foreground-muted">
                    Đã Thanh toán: <span className="font-semibold text-foreground">{latestPaymentMethodLabel}</span>
                  </span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">
                    {fmt(totalAppliedPaymentAmount)}
                  </span>
                </div>
                <div className="mt-2 space-y-1.5 pl-3">
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-foreground-muted">Tiền hàng</span>
                    <span className="font-medium text-foreground tabular-nums">{fmt(orderPaymentAmount)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-foreground-muted">Nợ cũ</span>
                    <span className="font-medium text-foreground tabular-nums">{fmt(debtSettlementAmount)}</span>
                  </div>
                </div>
              </div>
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

            <div className="flex min-h-0 flex-1 flex-col px-3 py-3">
              <div className="flex min-h-0 flex-1 flex-col rounded-xl border border-border bg-background-secondary p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Lịch sử
                  </div>
                  <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusView.toneClass}`}>
                    {statusView.label}
                  </span>
                </div>

                <div className="mt-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                  {enhancedActivityTimelineEntries.map((entry, index) => (
                    <div key={`${entry.title}-${entry.time}-${entry.detail}-${index}`} className="grid grid-cols-[18px_1fr] gap-3">
                      <div className="flex flex-col items-center">
                        <span className={`mt-1 h-2.5 w-2.5 rounded-full ${entry.tone === 'text-primary-500'
                          ? 'bg-primary-500'
                          : entry.tone === 'text-amber-500'
                            ? 'bg-amber-500'
                            : entry.tone === 'text-sky-500'
                              ? 'bg-sky-500'
                              : entry.tone === 'text-orange-400'
                                ? 'bg-orange-400'
                                : entry.tone === 'text-emerald-400'
                                  ? 'bg-emerald-400'
                                  : 'bg-border'
                          }`} />
                        {index < enhancedActivityTimelineEntries.length - 1 ? (
                          <span className="mt-1 h-full w-px bg-border" />
                        ) : null}
                      </div>
                      <div className="min-w-0 pb-1">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className={`truncate text-sm font-semibold ${entry.tone}`}>{entry.title}</span>
                            {entry.actor ? (
                              <span className="truncate text-[11px] text-foreground-muted">{entry.actor}</span>
                            ) : null}
                          </div>
                          <span className="shrink-0 text-[11px] text-foreground-muted whitespace-nowrap">{entry.time}</span>
                        </div>
                        {entry.detail || entry.voucherHref || entry.voucherLabel ? (
                          <div className="mt-0.5 flex items-start justify-between gap-3 text-xs text-foreground-muted">
                            <span className="min-w-0 truncate">{entry.detail ?? '—'}</span>
                            {entry.voucherHref && entry.voucherLabel ? (
                              <Link
                                href={entry.voucherHref}
                                className="shrink-0 text-primary-400 transition hover:text-primary-300"
                              >
                                {entry.voucherLabel}
                              </Link>
                            ) : entry.voucherLabel ? (
                              <span className="shrink-0 text-primary-400">{entry.voucherLabel}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </div>

      </div>
    </ReceiptWorkspace>
  )
}
