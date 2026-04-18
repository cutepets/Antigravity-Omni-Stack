'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ChevronDown, Loader2, Printer, QrCode, RefreshCw, Save, PencilLine, XCircle } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { CartItem } from '@petshop/shared'
import { ServiceBookingModal } from '@/app/(dashboard)/_shared/service/components/ServiceBookingModal'
import { ExportStockModal } from './export-stock-modal'
import { PaymentModal as OrderPaymentModal } from '@/app/(dashboard)/_shared/payment/components/PaymentModal'
import { OrderPetPickerModal } from './order-pet-picker-modal'
import { OrderSettlementModal } from './order-settlement-modal'
import { OrderRefundModal } from './order-refund-modal'
import { OrderReturnModal } from './order-return-modal'
import { OrderTopBar } from './order/order-top-bar'
import { OrderRightPanel } from './order/order-right-panel'
import { printOrderA4, printOrderK80, printOrderPdf } from './order/order-print'
import type { OrderWorkspaceMode } from './order/order.types'
import { useOrderWorkspace } from './order/use-order-workspace'
import { QrPaymentModal } from '@/app/(dashboard)/_shared/payment/components/QrPaymentModal'
import { SwapTempItemModal } from './swap-temp-item-modal'
import {
  buildOrderQrIntentStorageKey,
  createOrderQrPaymentIntent,
} from '@/app/(dashboard)/_shared/payment/payment-intent.utils'
import { usePaymentIntentSession } from '@/app/(dashboard)/_shared/payment/use-payment-intent-session'
import { PosProductSearch } from '@/app/(dashboard)/pos/components/PosProductSearch'
import { PosCartItems, type CartItemCallbacks } from '@/app/(dashboard)/pos/components/PosCartItems'
import { useBranches } from '@/app/(dashboard)/_shared/branches/use-branches'

export function OrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const { data: branches = [] } = useBranches()
  const workspace = useOrderWorkspace({ mode, orderId })
  const [showPrintMenu, setShowPrintMenu] = useState(false)
  const printMenuRef = useRef<HTMLDivElement | null>(null)
  const showPrintActions = mode === 'detail' && Boolean(workspace.printPayload)

  const [swapItemTarget, setSwapItemTarget] = useState<{ id: string; description: string; unitPrice: number } | null>(null)
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null)
  const [discountEditingId, setDiscountEditingId] = useState<string | null>(null)
  const [isMultiSelect, setIsMultiSelect] = useState(false)

  const orderNumber = workspace.order?.orderNumber as string | undefined
  const {
    activeIntent: qrIntent,
    displayedIntent: displayedQrIntent,
    isModalOpen: showQrModal,
    setIsModalOpen: setShowQrModal,
    openIntent: openQrIntent,
    clearIntent: clearQrIntent,
    hasResumeIntent: resumeQrBanner,
  } = usePaymentIntentSession({
    storageKey: orderNumber ? buildOrderQrIntentStorageKey(orderNumber) : null,
  })

  // Handler: cước BANK/Ví → tạo hoặc fetch payment intent rồi mở QR modal
  const handleRequestQr = async (paymentAccountId: string, amount: number) => {
    try {
      const orderId = workspace.order?.id
      if (!orderId) {
        throw new Error('Missing order id for QR payment intent')
      }

      const intent = await createOrderQrPaymentIntent({
        orderId,
        paymentMethodId: paymentAccountId,
        amount,
      })
      openQrIntent(intent)
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
          canCancelOrder: workspace.actionFlags.canCancelOrder,
        }}
        onBack={workspace.handleBack}
        onEdit={workspace.handleStartEdit}
        onSave={workspace.handleSave}
        onCancelEdit={workspace.handleCancelEdit}
        onCustomerSearchChange={workspace.setCustomerSearch}
        onSelectCustomer={workspace.handleSelectCustomer}
        onClearCustomer={workspace.handleClearCustomer}
        onOpenPay={() => workspace.setShowPayModal(true)}
        onOpenExportStock={() => workspace.setShowExportStockModal(true)}
        onOpenSettle={() => workspace.setShowSettleModal(true)}
        onOpenRefund={() => workspace.setShowRefundModal(true)}
        onOpenReturn={() => workspace.setShowReturnModal(true)}
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
              clearQrIntent()
              setShowQrModal(false)
              workspace.setShowPayModal(true)
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-background-secondary"
          >
            <RefreshCw size={13} />
            Đổi hình thức TT
          </button>
        </div>
      )}

      {/* Banner: còn item tạm chưa swap sau khi đã xuất kho */}
      {workspace.order?.stockExportedAt && workspace.order?.items?.some((i: any) => i.isTemp) && (
        <div className="mx-4 mt-2 flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/8 px-4 py-2.5">
          <AlertCircle size={16} className="shrink-0 text-amber-500" />
          <span className="flex-1 text-sm font-medium text-foreground">
            Đơn có{' '}
            <strong>{workspace.order.items.filter((i: any) => i.isTemp).length} sản phẩm tạm</strong>{' '}
            chưa được đổi sang thật — tồn kho chưa cập nhật
          </span>
        </div>
      )}

      <div className="relative z-10 m-4 mb-4 mt-2 flex flex-1 flex-col overflow-hidden rounded-[26px] border border-border bg-background-secondary/35 shadow-sm">
        <div className="shrink-0 flex items-center gap-3 border-b border-border/60 bg-background/50 px-5 py-2.5">
          <PosProductSearch
            onSelect={workspace.isEditing ? workspace.addCatalogItem : () => { }}
            branchId={workspace.draft?.branchId ?? undefined}
            cartItems={workspace.draft?.items ?? []}
            isMultiSelectControlled
            isMultiSelectValue={isMultiSelect}
            onSetMultiSelect={setIsMultiSelect}
            disabled={!workspace.isEditing}
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

          {/* Action buttons moved from Top Bar */}
          {mode === 'create' ? (
            <button
              type="button"
              onClick={workspace.handleSave}
              disabled={workspace.pendingAction}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {workspace.pendingAction ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Tạo đơn hàng
            </button>
          ) : mode === 'detail' && workspace.actionFlags.canEditCurrentOrder && !workspace.isEditing ? (
            <button
              type="button"
              onClick={workspace.handleStartEdit}
              className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            >
              <PencilLine size={14} />
              Cập nhật
            </button>
          ) : mode === 'detail' && workspace.isEditing ? (
            <>
              <button
                type="button"
                onClick={workspace.handleSave}
                disabled={workspace.pendingAction}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90 disabled:opacity-60"
              >
                {workspace.pendingAction ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                Lưu cập nhật
              </button>
              <button
                type="button"
                onClick={workspace.handleCancelEdit}
                className="inline-flex h-9 items-center gap-2 rounded-xl border border-border bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-background-tertiary"
              >
                <XCircle size={14} />
                Hủy sửa
              </button>
            </>
          ) : null}
        </div>

        <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_480px]">
          <div className="flex min-h-0 flex-col overflow-hidden border-r border-border/60">
            <OrderCartSection
              draft={workspace.draft}
              branches={branches}
              selectedRowIndex={workspace.selectedRowIndex}
              isEditing={workspace.isEditing}
              noteEditingId={noteEditingId}
              setNoteEditingId={setNoteEditingId}
              discountEditingId={discountEditingId}
              setDiscountEditingId={setDiscountEditingId}
              onChangeQuantity={workspace.handleChangeItemQuantity}
              onChangeItemDiscount={workspace.handleChangeItemDiscount}
              onRemoveItem={workspace.handleRemoveItem}
              onSwapItem={(item: any) => setSwapItemTarget({ id: item.orderItemId ?? item.id, description: item.description, unitPrice: item.unitPrice })}
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
              paymentIntents={workspace.paymentIntents as any[]}
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
          <OrderRefundModal
            isOpen={workspace.showRefundModal}
            onClose={() => workspace.setShowRefundModal(false)}
            onConfirm={(payload) => workspace.refundOrderMutation.mutate(payload)}
            orderNumber={workspace.order?.orderNumber || '--'}
            isPending={workspace.refundOrderMutation.isPending}
          />
          <OrderReturnModal
            open={workspace.showReturnModal}
            onClose={() => workspace.setShowReturnModal(false)}
            order={workspace.order}
            onConfirm={(payload) => workspace.createReturnRequestMutation.mutate(payload)}
            isLoading={workspace.createReturnRequestMutation.isPending}
          />
        </>
      ) : null}

      {/* QR Payment Modal */}
      {displayedQrIntent && showQrModal ? (
        <QrPaymentModal
          isOpen={showQrModal}
          onClose={() => setShowQrModal(false)}
          intent={displayedQrIntent}
        />
      ) : null}

      {/* Swap Temp Item Modal */}
      {swapItemTarget && workspace.order?.id && (
        <SwapTempItemModal
          isOpen={Boolean(swapItemTarget)}
          onClose={() => setSwapItemTarget(null)}
          orderId={workspace.order.id}
          itemId={swapItemTarget.id}
          itemDescription={swapItemTarget.description}
          targetUnitPrice={swapItemTarget.unitPrice}
        />
      )}

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
    </div>
  )
}

// ── OrderCartSection ─────────────────────────────────────────────────────────
// Adapter: maps useOrderWorkspace draft items → CartItem format consumed by PosCartItems.

type OrderCartSectionProps = {
  draft: any
  branches: any[]
  selectedRowIndex: number
  isEditing: boolean
  noteEditingId: string | null
  setNoteEditingId: (id: string | null) => void
  discountEditingId: string | null
  setDiscountEditingId: (id: string | null) => void
  onChangeQuantity: (index: number, value: string) => void
  onChangeItemDiscount: (index: number, value: string) => void
  onRemoveItem: (index: number) => void
  onSwapItem?: (item: any) => void
}

function OrderCartSection({
  draft,
  branches,
  selectedRowIndex,
  isEditing,
  noteEditingId,
  setNoteEditingId,
  discountEditingId,
  setDiscountEditingId,
  onChangeQuantity,
  onChangeItemDiscount,
  onRemoveItem,
}: OrderCartSectionProps) {
  // Map draft items to CartItem shape expected by PosCartItems
  const cartItems = useMemo<CartItem[]>(
    () =>
      (draft.items ?? []).map((item: any) => ({
        id: item.id,
        productId: item.productId ?? undefined,
        serviceId: item.serviceId ?? undefined,
        productVariantId: item.productVariantId ?? undefined,
        description: item.description,
        sku: item.sku ?? undefined,
        image: item.image ?? undefined,
        unit: item.unit ?? undefined,
        unitPrice: Number(item.unitPrice || 0),
        quantity: Number(item.quantity || 1),
        discountItem: Number(item.discountItem || 0),
        itemNotes: item.itemNotes ?? item.note ?? undefined,
        type: item.type ?? 'product',
        variants: item.variants ?? undefined,
        branchStocks: item.branchStocks ?? undefined,
        stock: item.stock ?? undefined,
        availableStock: item.availableStock ?? undefined,
        hotelDetails: item.hotelDetails ?? undefined,
        // Pass extra fields through for swap badge rendering
        isTemp: item.isTemp,
        stockExportedAt: item.stockExportedAt,
        orderItemId: item.orderItemId,
      })),
    [draft.items],
  )

  // Map callbacks — PosCartItems works with item.id, OrderWorkspace with index
  const callbacks = useMemo<CartItemCallbacks>(() => {
    const findIndex = (id: string) => (draft.items ?? []).findIndex((item: any) => item.id === id)
    return {
      onRemoveItem: (id) => {
        const idx = findIndex(id)
        if (idx >= 0) onRemoveItem(idx)
      },
      onUpdateQuantity: (id, qty) => {
        const idx = findIndex(id)
        if (idx >= 0) onChangeQuantity(idx, String(qty))
      },
      onUpdateDiscountItem: (id, discount) => {
        const idx = findIndex(id)
        if (idx >= 0) onChangeItemDiscount(idx, String(discount))
      },
      onUpdateItemVariant: (_id, _variantId) => {
        // Order variant switching not yet supported — no-op
      },
      onUpdateItemNotes: (_id, _notes) => {
        // Order item notes not yet wired — no-op
      },
    }
  }, [draft.items, onChangeItemDiscount, onChangeQuantity, onRemoveItem])

  if (!isEditing && cartItems.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-foreground-muted">
        <div className="text-sm font-semibold text-foreground">Chưa có sản phẩm hoặc dịch vụ</div>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-y-auto custom-scrollbar">
      <PosCartItems
        cart={cartItems}
        branchId={draft.branchId ?? undefined}
        branches={branches}
        selectedRowIndex={selectedRowIndex}
        noteEditingId={noteEditingId}
        setNoteEditingId={setNoteEditingId}
        discountEditingId={discountEditingId}
        setDiscountEditingId={setDiscountEditingId}
        callbacks={callbacks}
      />
    </div>
  )
}
