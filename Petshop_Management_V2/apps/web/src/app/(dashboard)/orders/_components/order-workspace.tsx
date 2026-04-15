'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
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
import { printOrderA4, printOrderK80, printOrderPdf } from './order/order-print'
import type { OrderWorkspaceMode } from './order/order.types'
import { useOrderWorkspace } from './order/use-order-workspace'

export function OrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const workspace = useOrderWorkspace({ mode, orderId })

  // ── Loading ──────────────────────────────────────────────────────────────
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

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="-mx-6 -mt-2 -mb-6 flex h-[calc(100vh-56px)] flex-col overflow-hidden rounded-[24px] border border-border/70 bg-background shadow-[0_30px_80px_-45px_rgba(15,23,42,0.65)]">

      {/* ── HEADER BAR: 4 cột ────────────────────────────────────────────── */}
      <OrderTopBar
        mode={mode}
        order={workspace.order}
        draft={workspace.draft}
        branches={workspace.branches}
        customerSearch={workspace.customerSearch}
        customerResults={workspace.customerResults}
        selectedCustomerName={workspace.selectedCustomerName}
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
        onBranchChange={workspace.handleChangeBranch}
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
        onPrintA4={() => workspace.printPayload && printOrderA4(workspace.printPayload)}
        onPrintK80={() => workspace.printPayload && printOrderK80(workspace.printPayload)}
        onPrintPdf={() => workspace.printPayload && printOrderPdf(workspace.printPayload)}
      />

      {/* ── SEARCH BAR (giống receipt top bar) ───────────────────────────── */}
      <div className="shrink-0 flex items-center gap-3 border-b border-border bg-background-secondary/40 px-5 py-2.5">
        <OrderSearchPanel
          itemSearch={workspace.itemSearch}
          isEditing={workspace.isEditing}
          productMatches={workspace.productMatches}
          serviceMatches={workspace.serviceMatches}
          onSearchChange={workspace.setItemSearch}
          onAddCatalogItem={workspace.addCatalogItem}
        />
      </div>

      {/* ── MAIN BODY: Table + Sidebar ────────────────────────────────────── */}
      <div className="grid flex-1 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px] rounded-[26px] border border-border bg-background-secondary/35 m-4 mt-0">

        {/* ── LEFT: Bảng sản phẩm ─────────────────────────────────────────── */}
        <div className="flex min-h-0 flex-col overflow-hidden border-r border-border/60">
          <OrderItemsTable
            items={workspace.draft.items}
            isEditing={workspace.isEditing}
            onChangeQuantity={workspace.handleChangeItemQuantity}
            onChangeUnitPrice={workspace.handleChangeItemUnitPrice}
            onRemoveItem={workspace.handleRemoveItem}
          />
        </div>

        {/* ── RIGHT: Tổng tiền + Ghi chú + Timeline ───────────────────────── */}
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
            itemsCount={workspace.draft.items.length}
            orderStatus={workspace.order?.status}
          />
        </div>
      </div>

      {/* ── MODALS ───────────────────────────────────────────────────────── */}
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
