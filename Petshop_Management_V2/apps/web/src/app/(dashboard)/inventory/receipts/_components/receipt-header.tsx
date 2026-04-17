import React from 'react'
import Link from 'next/link'
import dayjs from 'dayjs'
import {
  Building2,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Copy,
  FileDown,
  FileSpreadsheet,
  History,
  MoreHorizontal,
  Package2,
  Phone,
  Plus,
  Printer,
  Trash2,
  UserPlus
} from 'lucide-react'

import { exportAoaToExcel } from '@/lib/excel'
import { customToast as toast } from '@/components/ui/toast-with-copy'

import { SUPPLIER_RECEIPT_DRAFT_KEY } from './receipt/receipt.constants'
import { SupplierQuickDraftPayload } from './receipt/receipt.types'
import { getReceiptStatusView , fmt } from './receipt/receipt.utils'
import { useReceiptForm } from './receipt/use-receipt-form'

interface ReceiptHeaderProps {
  form: ReturnType<typeof useReceiptForm>
}

export function ReceiptHeader({ form }: ReceiptHeaderProps) {
  const {
    isEditMode,
    isExistingReceipt,
    receipt,
    resolvedReceiptId,
    statusView: hookStatusView, // wait, getReceiptStatusView is imported
    displaySupplier,
    currentBranch,
    items,
    totalQuantity,
    isReadOnly,
    supplierId,
    setSupplierId,
    supplierQuery,
    setSupplierQuery,
    showSupplierSearch,
    setShowSupplierSearch,
    handleOpenQuickSupplier,
    filteredSuppliers,
    handleSelectSupplier,
    branchId,
    setBranchId,
    allowedBranches,
    applyLatestSupplierPricesToItems,
    currentDebt,
    currentSupplierDebt,
    supplierPanelRef,
    user,
    visibleProgressSteps,
    saveMutation,
    handleSubmit,
    canShowPaymentAction,
    openPaymentModal,
    payMutation,
    canShowReceiveAction,
    receiveMutation,
    canShowCancelAction,
    cancelMutation,
    canShowReturnAction,
    openReturnModal,
    returnMutation,
    exportMenuRef,
    showExportMenu,
    setShowExportMenu,
    merchandiseTotal,
    receiptDiscount,
    discountAmount,
    receiptTax,
    taxAmount,
    grandTotal,
    notes,
  } = form
  const supplierOtherDebt = Math.max(0, currentSupplierDebt - (isExistingReceipt ? currentDebt : 0))

  const creatorDisplayName =
    receipt?.createdBy?.fullName ||
    receipt?.createdBy?.username ||
    receipt?.createdBy?.name ||
    user?.fullName ||
    user?.username ||
    'Chưa xác định'

  const statusView = getReceiptStatusView(receipt)

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
        (item: any, idx: number) => `
        <tr>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${idx + 1}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;">${item.name}${item.variantName ? ` (${item.variantName})` : ''}${item.sku ? `<br><small style="color:#999">${item.sku}</small>` : ''}</td>
          <td style="padding:4px 6px;border-bottom:1px solid #eee;text-align:right;">${item.unit ?? '—'}</td>
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
  <div class="meta">
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
    const supplierName = displaySupplier?.name ?? ''
    const createdAt = receipt?.createdAt ? dayjs(receipt.createdAt).format('DD/MM/YYYY HH:mm') : ''

    const headerRows: Array<Array<string | number | null>> = [
      ['PHIẾU NHẬP HÀNG'],
      ['Mã phiếu:', receiptCode, '', 'Nhà cung cấp:', supplierName],
      ['Ngày tạo:', createdAt, '', 'Chi nhánh:', currentBranch?.name ?? ''],
      ['Trạng thái:', statusView.label],
      [],
    ]

    const colHeaders = ['#', 'Mã SP (SKU)', 'Tên sản phẩm', 'Phiên bản', 'Đơn vị', 'Số lượng', 'Đơn giá nhập', 'Giảm giá', 'Thành tiền']

    const itemRows: Array<Array<string | number | null>> = items.map((item: any, idx: number) => [
      idx + 1,
      item.sku ?? '',
      item.name,
      item.variantName ?? '',
      item.unit ?? '',
      item.quantity,
      item.unitCost,
      item.discount,
      item.quantity * item.unitCost,
    ])

    const summaryRows: Array<Array<string | number | null>> = [
      [],
      ['', '', '', '', '', '', '', 'Tổng hàng hóa', merchandiseTotal],
      ...(receiptDiscount > 0 ? [['', '', '', '', '', '', '', 'Giảm giá', -discountAmount]] : []),
      ...(receiptTax > 0 ? [['', '', '', '', '', '', '', 'Thuế', taxAmount]] : []),
      ['', '', '', '', '', '', '', 'Cần trả NCC', grandTotal],
      ...(currentDebt > 0 ? [['', '', '', '', '', '', '', 'Còn nợ', currentDebt]] : []),
    ]

    const wsData = [...headerRows, colHeaders, ...itemRows, ...summaryRows]
    const fileName = `phieu-nhap-${receiptCode}-${dayjs().format('YYYYMMDD')}.xlsx`
    await exportAoaToExcel(wsData, 'Phiếu nhập', fileName, [8, 14, 36, 16, 10, 10, 16, 14, 16])
    toast.success(`Đã xuất file ${fileName}`)
  }

  // NOTE: the return starts from line 591 in create-receipt-form.tsx

  return (
    <div className="shrink-0 border-b border-border bg-background">
      <div className="flex h-14 items-center justify-between px-3 md:px-6">
        <div className="flex min-w-0 items-center gap-4">
          <Link
            href="/dashboard/inventory/receipts"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-foreground-muted hover:bg-background-secondary hover:text-foreground transition-colors"
          >
            <ArrowLeft size={18} />
          </Link>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-lg font-bold text-foreground">
                {isEditMode ? 'Cập nhật phiếu nhập' : isExistingReceipt ? 'Chi tiết phiếu nhập' : 'Tạo phiếu nhập'}
              </h1>
              {isExistingReceipt && (
                <div className={statusView.toneClass}>
                  {statusView.label}
                </div>
              )}
            </div>
            {isExistingReceipt && (
              <div className="mt-0.5 flex items-center gap-2 text-xs text-foreground-muted">
                <span className="font-medium text-foreground">{receipt?.receiptNumber}</span>
                <span>•</span>
                <span>Tạo lúc {dayjs(receipt?.createdAt).format('HH:mm DD/MM/YYYY')}</span>
                <span>•</span>
                <span>Bởi {creatorDisplayName}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {isExistingReceipt ? (
            <>
              {/* Export menu using inline ref as requested originally */}
              <div className="relative" ref={exportMenuRef}>
                <button
                  type="button"
                  onClick={() => setShowExportMenu(!showExportMenu)}
                  className="btn-outline h-9 px-3 gap-2"
                >
                  <FileDown size={14} />
                  <span>Xuất file</span>
                  <ChevronDown size={14} />
                </button>

                {showExportMenu && (
                  <div className="absolute right-0 top-[calc(100%+8px)] z-50 w-48 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                    <div className="p-1">
                      <button
                        onClick={handleDuplicateReceipt}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-secondary rounded-lg"
                      >
                        <Copy size={16} className="text-primary-500" />
                        Sao chép đơn nhập
                      </button>
                      <div className="my-1 border-t border-border" />
                      <button
                        onClick={() => handlePrintReceipt('k80')}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-secondary rounded-lg"
                      >
                        <Printer size={16} className="text-sky-500" />
                        In hóa đơn K80
                      </button>
                      <button
                        onClick={() => handlePrintReceipt('a4')}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-secondary rounded-lg"
                      >
                        <Printer size={16} className="text-sky-500" />
                        In khổ A4
                      </button>
                      <button
                        onClick={handleExportExcel}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-background-secondary rounded-lg"
                      >
                        <FileSpreadsheet size={16} className="text-emerald-500" />
                        Xuất file Excel
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              {canShowPaymentAction && (
                <button
                  type="button"
                  className="btn-primary h-9 px-4 shadow-sm"
                  onClick={openPaymentModal}
                  disabled={payMutation.isPending}
                >
                  {payMutation.isPending ? 'Đang xử lý...' : 'Thanh toán'}
                </button>
              )}

              {canShowReceiveAction && (
                <button
                  type="button"
                  className="btn-primary bg-sky-500 hover:bg-sky-600 text-white h-9 px-4 shadow-sm"
                  onClick={() => receiveMutation.mutate()}
                  disabled={receiveMutation.isPending}
                >
                  {receiveMutation.isPending ? 'Đang xử lý...' : 'Nhập kho'}
                </button>
              )}

              {canShowReturnAction && (
                <button
                  type="button"
                  className="btn-outline border-orange-500/30 text-orange-600 hover:bg-orange-50 h-9 px-4"
                  onClick={openReturnModal}
                  disabled={returnMutation.isPending}
                >
                  {returnMutation.isPending ? 'Đang xử lý...' : 'Hoàn trả'}
                </button>
              )}

              {canShowCancelAction && (
                <button
                  type="button"
                  className="btn-outline border-error/30 text-error hover:bg-error/10 h-9 px-4"
                  onClick={() => {
                    if (window.confirm('Bạn có chắc chắn muốn hủy phiếu nhập này?')) {
                      cancelMutation.mutate()
                    }
                  }}
                  disabled={cancelMutation.isPending}
                >
                  {cancelMutation.isPending ? 'Đang xử lý...' : 'Hủy đơn'}
                </button>
              )}
            </>
          ) : (
            <>
              {/* Desktop quick access header slots if needed, mobile uses a quick form below. */}
              <button
                type="button"
                className="btn-primary h-9 px-4 shadow-sm"
                onClick={() => handleSubmit('draft')}
                disabled={saveMutation.isPending || items.length === 0}
              >
                {saveMutation.isPending ? (
                  'Đang xử lý...'
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Lưu phiếu nhập</span>
                  </>
                )}
              </button>
            </>
          )}

          {/* More actions dummy dropdown for edit mode */}
          {isEditMode && (
            <button className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-foreground-muted hover:bg-background-secondary transition-colors">
              <MoreHorizontal size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-background-secondary/30 px-3 py-2 md:px-6">
        <div className="flex flex-wrap items-center gap-4 lg:hidden">
          {/* Supplier block for mobile etc goes here if we want responsive */}
        </div>
        <div className="hidden lg:flex items-center gap-6">
          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-500/10 text-primary-500">
              <Building2 size={14} />
            </div>
            <div>
              <div className="font-medium text-foreground">
                {displaySupplier?.name || 'Nhà cung cấp'}
              </div>
              <div className="text-xs text-foreground-muted">
                {displaySupplier?.phone || 'Chưa chọn'}
              </div>
              {displaySupplier ? (
                <div className="mt-1 space-y-0.5 text-xs">
                  {isExistingReceipt ? (
                    <div className={`font-semibold ${currentDebt > 0 ? 'text-error' : 'text-success'}`}>
                      {currentDebt > 0 ? `Nợ phiếu này: ${fmt(currentDebt)}` : 'Phiếu đã thanh toán'}
                    </div>
                  ) : null}
                  <div className={`font-semibold ${currentSupplierDebt > 0 ? 'text-warning' : 'text-success'}`}>
                    {currentSupplierDebt > 0 ? `Tổng nợ: ${fmt(currentSupplierDebt)}` : 'Không còn nợ NCC'}
                  </div>
                  {isExistingReceipt && supplierOtherDebt > 0 ? (
                    <div className="text-foreground-muted">
                      Nợ phiếu khác: {fmt(supplierOtherDebt)}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="h-8 w-px bg-border" />

          <div className="flex items-center gap-3 text-sm">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-500/10 text-sky-500">
              <Package2 size={14} />
            </div>
            <div>
              <div className="font-medium text-foreground">
                {currentBranch?.name || 'Chi nhánh'}
              </div>
              <div className="text-xs text-foreground-muted">
                {items.length} mặt hàng, {totalQuantity} SP
              </div>
            </div>
          </div>

          <div className="h-8 w-px bg-border" />

          {/* This part needs to be computed locally so we use visibleProgressSteps passed from form */}
          <div className="flex flex-1 items-center gap-2">
            {visibleProgressSteps
              ? visibleProgressSteps.map((step: any, idx: number) => (
                  <React.Fragment key={step.title}>
                    <div className="flex items-center gap-2">
                      <div
                        className={`flex h-5 items-center justify-center rounded-full px-2 text-[10px] font-bold uppercase tracking-wide ${
                          step.state === 'completed'
                            ? 'bg-primary-500/10 text-primary-500'
                            : step.state === 'active'
                              ? 'bg-warning/10 text-warning'
                              : step.state === 'alert'
                                ? 'bg-error/10 text-error'
                                : 'bg-background-tertiary text-foreground-muted'
                        }`}
                      >
                        {step.title}
                      </div>
                      <span className="text-[11px] font-medium text-foreground-muted">
                        {step.meta}
                      </span>
                    </div>
                    {idx < visibleProgressSteps.length - 1 && (
                      <div className="h-[1px] flex-1 bg-border" />
                    )}
                  </React.Fragment>
                ))
              : null}
          </div>
        </div>
      </div>
    </div>
  )
}
