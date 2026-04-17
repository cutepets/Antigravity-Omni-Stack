'use client'

import { useEffect, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, Printer, QrCode, RefreshCw } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ServiceBookingModal } from '@/app/(dashboard)/pos/components/ServiceBookingModal'
import { ApproveOrderModal } from './approve-order-modal'
import { ExportStockModal } from './export-stock-modal'
import { OrderPaymentModal } from './order-payment-modal'
import { OrderPetPickerModal } from './order-pet-picker-modal'
import { OrderSettlementModal } from './order-settlement-modal'
import { OrderTopBar } from './order/order-top-bar'
import { OrderSearchPanel } from './order/order-search-panel'
import { OrderItemsTable } from './order/order-items-table'
import { OrderRightPanel } from './order/order-right-panel'
import { ProductVariantSelector } from './order/product-variant-selector'
import { printOrderA4, printOrderK80, printOrderPdf } from './order/order-print'
import type { OrderWorkspaceMode } from './order/order.types'
import { useOrderWorkspace } from './order/use-order-workspace'
import { PosQrPaymentModal } from '@/app/(dashboard)/pos/components/PosQrPaymentModal'

const QR_STORAGE_KEY = (orderNumber: string) => `order-qr-intent-${orderNumber}`

export function OrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const workspace = useOrderWorkspace({ mode, orderId })
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const printMenuRef = useRef<HTMLDivElement | null>(null)
  const showPrintActions = mode === 'detail' && Boolean(workspace.printPayload)

  // -- QR payment state --
  const [qrIntent, setQrIntent] = useState<any>(null)
  const [showQrModal, setShowQrModal] = useState(false)
  const [resumeQrBanner, setResumeQrBanner] = useState(false)

  const orderNumber = workspace.order?.orderNumber as string | undefined

  // Check localStorage for pending QR intent on mount
  useEffect(() => {
    if (!orderNumber) return
    const stored = localStorage.getItem(QR_STORAGE_KEY(orderNumber))
    if (!stored) return
    try {
      const intent = JSON.parse(stored)
      if (intent && intent.status !== 'PAID') {
        setQrIntent(intent)
        setResumeQrBanner(true)
      } else {
        localStorage.removeItem(QR_STORAGE_KEY(orderNumber))
      }
    } catch {
      localStorage.removeItem(QR_STORAGE_KEY(orderNumber))
    }
  }, [orderNumber])

  // Save intent to localStorage whenever it changes
  useEffect(() => {
    if (!orderNumber || !qrIntent) return
    if (qrIntent.status === 'PAID') {
      localStorage.removeItem(QR_STORAGE_KEY(orderNumber))
      setResumeQrBanner(false)
    } else {
      localStorage.setItem(QR_STORAGE_KEY(orderNumber), JSON.stringify(qrIntent))
    }
  }, [orderNumber, qrIntent])

  // Handler: cước BANK/Ví → tạo hoặc fetch payment intent rồi mở QR modal
  const handleRequestQr = async (paymentAccountId: string, amount: number) => {
    try {
      const res = await api.post('/payment-intents', {
        orderId: workspace.order?.id,
        paymentAccountId,
        amount,
      })
      const intent = res.data?.data ?? res.data
      setQrIntent(intent)
      setShowQrModal(true)
      setResumeQrBanner(false)
      workspace.setShowPayModal(false)
    } catch {
      // fallback: confirm cash payment via normal flow
      workspace.payOrderMutation.mutate({ payments: [{ method: 'BANK', amount, paymentAccountId }] })
    }
  }

  // -- Customer detail for points/debt --
  const customerId = workspace.draft?.customerId
  const { data: customerDetail } = useQuery({
    queryKey: ['order-customer-detail', customerId],
    queryFn: async () => {
      if (!customerId) return null
      const res = await api.get(`/customers/${customerId}`)
      return res.data?.data ?? res.data
    },
    enabled: !!customerId,
  })

  useEffect(() => {
    if (!showPrintMenu) return
    const handleClickOutside = (event: MouseEvent) => {
      if (printMenuRef.current?.contains(event.target as Node)) return
      setShowPrintMenu(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showPrintMenu])

  if (workspace.showLoading) {
    return (
      <div className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] items-center justify-center">
        <div className="flex items-center gap-3 text-sm font-medium text-foreground-muted">
          <Loader2 size={18} className="animate-spin" />
          Đang tải dữ liệu đơn hàng...
        </div>
      </div>
    )
  }

  if (workspace.showForbidden) {
    return (
      <div className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] items-center justify-center text-sm font-medium text-foreground-muted">
        Đang chuyển hướng...
      </div>
    )
  }

  if (workspace.showNotFound) {
    return (
      <div className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] flex-col items-center justify-center gap-4 text-center">
        <AlertCircle size={48} className="text-error/70" />
        <div>
          <p className="text-lg font-semibold text-foreground">Không tìm thấy đơn hàng</p>
          <p className="mt-1 text-sm text-foreground-muted">
            Đơn hàng này có thể đã bị xoá hoặc bạn không còn quyền truy cập.
          </p>
        </div>
        <button
          type="button"
          onClick={workspace.handleBack}
          className="rounded-2xl border border-border bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-tertiary"
        >
          Quay lại danh sách
        </button>
      </div>
    )
  }

  return (
    <div className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] flex-col overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_30px_80px_-45px_rgba(15,23,42,0.65)]">
      <OrderTopBar
        mode={mode}
        order={workspace.order}
        draft={workspace.draft}
        customerSearch={workspace.customerSearch}
        customerResults={workspace.customerResults}
        selectedCustomerName={workspace.selectedCustomerName}
        selectedCustomerPhone={workspace.selectedCustomerPhone}
        selectedCustomerAddress={workspace.selectedCustomerAddress}
        customerPoints={customerDetail?.points}
        customerDebt={customerDetail?.debtAmount}
        branchName={workspace.branchName}
        showBranch={workspace.showBranch}
        operatorName={workspace.operatorName}
        operatorCode={workspace.operatorCode}
        isEditing={workspace.isEditing}
        pendingAction={workspace.pendingAction}
        canEdit={workspace.actionFlags.canEditCurrentOrder}
        visibleProgressSteps={workspace.visibleProgressSteps}
        actionFlags={{
          ...workspace.actionFlags,
          canCancelOrder: mode === 'detail' && workspace.order?.status !== 'CANCELLED',
        }}
        onBack={workspace.handleBack}
        onEdit={workspace.handleStartEdit}
        onSave={workspace.handleSave}
        onCancelEdit={workspace.handleCancelEdit}
        onCustomerSearchChange={workspace.setCustomerSearch}
        onSelectCustomer={workspace.handleSelectCustomer}
        onClearCustomer={workspace.handleClearCustomer}
        onOpenPay={() => workspace.setShowPayModal(true)}
        onOpenApprove={() => workspace.setShowApproveModal(true)}
        onOpenExportStock={() => workspace.setShowExportStockModal(true)}
        onOpenSettle={() => workspace.setShowSettleModal(true)}
        onCancelOrder={() => {
          if (!window.confirm('Bạn chắc chắn muốn huỷ đơn hàng này?')) return
          workspace.cancelOrderMutation.mutate()
        }}
        onOpenPos={workspace.handleGoPos}
      />

      {/* QR Resume Banner */}
      {resumeQrBanner && qrIntent && (
        <div className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-sky-500/25 bg-sky-500/8 px-4 py-2.5">
          <QrCode size={16} className="shrink-0 text-sky-500" />
          <span className="flex-1 text-sm font-medium text-foreground">
            Đơn hàng đang chờ xác nhận thanh toán QR
          </span>
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-sky-500 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-sky-600"
          >
            <QrCode size={13} />
            Xem lại QR
          </button>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem(QR_STORAGE_KEY(orderNumber ?? ''))
              setQrIntent(null)
              setResumeQrBanner(false)
              workspace.setShowPayModal(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background-secondary"
          >
            <RefreshCw size={13} />
            Đổi hình thức TT
          </button>
        </div>
      )}

      <div className="relative z-10 m-4 mb-4 mt-2 flex flex-1 flex-col overflow-hidden rounded-[26px] border border-border bg-background-secondary/35 shadow-sm">
        <div className="shrink-0 flex items-center gap-3 border-b border-border/60 bg-background/50 px-5 py-2.5">
          <OrderSearchPanel
            itemSearch={workspace.itemSearch}
            isEditing={workspace.isEditing}
            productMatches={workspace.productMatches}
            serviceMatches={workspace.serviceMatches}
            onSearchChange={workspace.setItemSearch}
            onAddCatalogItem={workspace.addCatalogItem}
          />

          {showPrintActions ? (
            <div className="relative shrink-0" ref={printMenuRef}>
              <button
                type="button"
                onClick={() => setShowPrintMenu((current) => !current)}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <Printer size={14} />
                In đơn
                <ChevronDown size={12} className={`transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
              </button>

              {showPrintMenu ? (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-44 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      if (workspace.printPayload) printOrderA4(workspace.printPayload)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={13} className="text-foreground-muted" />
                    In khổ A4
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      if (workspace.printPayload) printOrderK80(workspace.printPayload)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={13} className="text-foreground-muted" />
                    In K80
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowPrintMenu(false)
                      if (workspace.printPayload) printOrderPdf(workspace.printPayload)
                    }}
                    className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-background-secondary"
                  >
                    <Printer size={13} className="text-foreground-muted" />
                    Xuất PDF
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-border/60">
            <OrderItemsTable
              items={workspace.draft.items}
              isEditing={workspace.isEditing}
              selectedRowIndex={workspace.selectedRowIndex}
              onSelectRow={workspace.setSelectedRowIndex}
              onChangeQuantity={workspace.handleChangeItemQuantity}
              onChangeItemDiscount={workspace.handleChangeItemDiscount}
              onRemoveItem={workspace.handleRemoveItem}
            />
          </div>

          <div className="flex min-h-0 flex-col overflow-y-auto custom-scrollbar">
            <OrderRightPanel
              mode={mode}
              subtotal={workspace.subtotal}
              discount={workspace.draft.discount}
              shippingFee={workspace.draft.shippingFee}
              total={workspace.total}
              isEditing={workspace.isEditing}
              onDiscountChange={workspace.handleChangeDiscount}
              onShippingFeeChange={workspace.handleChangeShippingFee}
              paymentStatus={workspace.order?.paymentStatus}
              amountPaid={workspace.amountPaid}
              remainingAmount={workspace.remainingAmount}
              notes={workspace.draft.notes}
              onNotesChange={workspace.handleChangeNotes}
              timeline={workspace.timeline as any[]}
              relatedDocuments={workspace.relatedDocuments}
              itemsCount={workspace.draft.items.length}
              orderStatus={workspace.order?.status}
            />
          </div>
        </div>
      </div>

      {mode === 'detail' ? (
        <>
          <OrderPaymentModal
            isOpen={workspace.showPayModal}
            onClose={() => workspace.setShowPayModal(false)}
            cartTotal={workspace.remainingAmount > 0 ? workspace.remainingAmount : workspace.total}
            paymentMethods={workspace.visiblePaymentMethods}
            initialPayments={[]}
            minimumMethods={1}
            title="Thu tiền đơn hàng"
            description="Chọn phương thức thanh toán cho đơn Orders."
            onConfirm={(payload) => workspace.payOrderMutation.mutate({ payments: payload.payments })}
            onRequestQr={handleRequestQr}
          />
          <ApproveOrderModal
            isOpen={workspace.showApproveModal}
            onClose={() => workspace.setShowApproveModal(false)}
            onConfirm={(payload) => workspace.approveOrderMutation.mutate(payload)}
            orderNumber={workspace.order?.orderNumber || '--'}
            isPending={workspace.approveOrderMutation.isPending}
          />
          <ExportStockModal
            isOpen={workspace.showExportStockModal}
            onClose={() => workspace.setShowExportStockModal(false)}
            onConfirm={(payload) => workspace.exportStockMutation.mutate(payload)}
            orderNumber={workspace.order?.orderNumber || '--'}
            isPending={workspace.exportStockMutation.isPending}
          />
          <OrderSettlementModal
            isOpen={workspace.showSettleModal}
            onClose={() => workspace.setShowSettleModal(false)}
            onConfirm={(payload) => workspace.settleOrderMutation.mutate(payload)}
            orderNumber={workspace.order?.orderNumber || '--'}
            total={workspace.total}
            amountPaid={workspace.amountPaid}
            canKeepCredit={workspace.canKeepCredit}
            isPending={workspace.settleOrderMutation.isPending}
            branchId={workspace.order?.branchId ?? workspace.draft.branchId}
          />
        </>
      ) : null}

      {/* QR Payment Modal */}
      {qrIntent && showQrModal ? (
        <PosQrPaymentModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          intent={qrIntent}
        />
      ) : null}

      <ServiceBookingModal
        isOpen={Boolean(workspace.hotelServiceDraft)}
        onClose={() => workspace.setHotelServiceDraft(null)}
        onConfirm={workspace.handleHotelBookingConfirm}
        service={workspace.hotelServiceDraft}
        customerId={workspace.draft.customerId}
      />
      <OrderPetPickerModal
        isOpen={Boolean(workspace.groomingServiceDraft)}
        onClose={() => workspace.setGroomingServiceDraft(null)}
        onConfirm={workspace.handleGroomingConfirm}
        pets={workspace.selectedPets}
        title={
          workspace.groomingServiceDraft
            ? `Chọn pet cho ${workspace.groomingServiceDraft.name}`
            : 'Chọn thú cưng'
        }
      />
      <ProductVariantSelector
        isOpen={Boolean(workspace.pendingProductEntry)}
        productName={workspace.pendingProductEntry?.productName ?? workspace.pendingProductEntry?.name ?? ''}
        variants={(workspace.pendingProductEntry?.variants ?? []).filter(
          (v: any) => !v.conversions || !Array.isArray(v.conversions) || v.conversions.length === 0,
        )}
        onSelect={workspace.handleSelectProductVariant}
        onClose={workspace.handleCloseVariantSelector}
      />
    </div>
  )
}
