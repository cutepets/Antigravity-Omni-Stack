'use client'

import { AlertCircle, Loader2 } from 'lucide-react'
import { PageContainer } from '@/components/layout/PageLayout'
import { ServiceBookingModal } from '@/app/(dashboard)/pos/components/ServiceBookingModal'
import { ApproveOrderModal } from './approve-order-modal'
import { ExportStockModal } from './export-stock-modal'
import { OrderPaymentModal } from './order-payment-modal'
import { OrderPetPickerModal } from './order-pet-picker-modal'
import { OrderSettlementModal } from './order-settlement-modal'
import { OrderActionsPanel } from './order/order-actions-panel'
import { OrderCustomerPanel } from './order/order-customer-panel'
import { OrderHeader } from './order/order-header'
import { OrderItemsTable } from './order/order-items-table'
import { OrderOverviewPanel } from './order/order-overview-panel'
import { OrderPaymentSummary } from './order/order-payment-summary'
import { printOrderA4, printOrderK80, printOrderPdf } from './order/order-print'
import { OrderSearchPanel } from './order/order-search-panel'
import { OrderTimeline } from './order/order-timeline'
import type { OrderWorkspaceMode } from './order/order.types'
import { useOrderWorkspace } from './order/use-order-workspace'

export function OrderWorkspace({ mode, orderId }: { mode: OrderWorkspaceMode; orderId?: string }) {
  const workspace = useOrderWorkspace({ mode, orderId })

  if (workspace.showLoading) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex h-[55vh] items-center justify-center">
          <div className="flex items-center gap-3 text-sm font-medium text-foreground-muted">
            <Loader2 size={18} className="animate-spin" />
            Dang tai du lieu don hang...
          </div>
        </div>
      </PageContainer>
    )
  }

  if (workspace.showForbidden) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex h-[55vh] items-center justify-center text-sm font-medium text-foreground-muted">
          Dang chuyen huong...
        </div>
      </PageContainer>
    )
  }

  if (workspace.showNotFound) {
    return (
      <PageContainer maxWidth="full" className="justify-center">
        <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
          <AlertCircle size={48} className="text-error/70" />
          <div>
            <p className="text-lg font-semibold text-foreground">Khong tim thay don hang</p>
            <p className="mt-1 text-sm text-foreground-muted">
              Don hang nay co the da bi xoa hoac ban khong con quyen truy cap.
            </p>
          </div>
          <button
            type="button"
            onClick={workspace.handleBack}
            className="rounded-2xl border border-border bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-tertiary"
          >
            Quay lai danh sach
          </button>
        </div>
      </PageContainer>
    )
  }

  const title =
    mode === 'create' ? 'Tao don hang Orders' : workspace.order?.orderNumber || 'Chi tiet don hang'
  const description =
    mode === 'create'
      ? 'Luong Orders moi: tao don nhieu buoc, luu va tiep tuc cap nhat tren cung workspace.'
      : 'Xem, cap nhat va xu ly don hang Orders tren mot man hinh thong nhat.'

  return (
    <PageContainer maxWidth="full" className="!gap-5 !py-4">
      <OrderHeader
        mode={mode}
        title={title}
        description={description}
        isEditing={workspace.isEditing}
        pendingAction={workspace.pendingAction}
        canEdit={workspace.actionFlags.canEditCurrentOrder}
        showPrintActions={Boolean(workspace.printPayload)}
        onBack={workspace.handleBack}
        onEdit={workspace.handleStartEdit}
        onSave={workspace.handleSave}
        onPrintA4={() => workspace.printPayload && printOrderA4(workspace.printPayload)}
        onPrintK80={() => workspace.printPayload && printOrderK80(workspace.printPayload)}
        onPrintPdf={() => workspace.printPayload && printOrderPdf(workspace.printPayload)}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.95fr)]">
        <div className="space-y-5">
          <div className="rounded-3xl border border-border bg-background-secondary/60 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.16em] text-primary-500">
                  Workspace Orders
                </div>
                <div className="mt-1 text-sm text-foreground-muted">
                  {workspace.branchName} • {workspace.draft.items.length} dong hang
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="badge badge-info">{mode === 'create' ? 'Create' : 'Detail'}</span>
                <span className="badge badge-outline">{workspace.isEditing ? 'Editing' : 'Readonly'}</span>
              </div>
            </div>
          </div>

          <OrderCustomerPanel
            branches={workspace.branches}
            draft={workspace.draft}
            isEditing={workspace.isEditing}
            customerSearch={workspace.customerSearch}
            customerResults={workspace.customerResults}
            onBranchChange={workspace.handleChangeBranch}
            onCustomerSearchChange={workspace.setCustomerSearch}
            onSelectCustomer={workspace.handleSelectCustomer}
            onClearCustomer={workspace.handleClearCustomer}
            onCustomerNameChange={workspace.handleChangeCustomerName}
            onDiscountChange={workspace.handleChangeDiscount}
            onShippingFeeChange={workspace.handleChangeShippingFee}
            onNotesChange={workspace.handleChangeNotes}
          />

          <OrderSearchPanel
            itemSearch={workspace.itemSearch}
            isEditing={workspace.isEditing}
            productMatches={workspace.productMatches}
            serviceMatches={workspace.serviceMatches}
            onSearchChange={workspace.setItemSearch}
            onAddCatalogItem={workspace.addCatalogItem}
          />

          <OrderItemsTable
            items={workspace.draft.items}
            isEditing={workspace.isEditing}
            onChangeQuantity={workspace.handleChangeItemQuantity}
            onChangeUnitPrice={workspace.handleChangeItemUnitPrice}
            onRemoveItem={workspace.handleRemoveItem}
          />
        </div>

        <div className="space-y-5">
          <OrderOverviewPanel
            mode={mode}
            order={workspace.order}
            branchName={workspace.branchName}
            customerDetail={workspace.customerDetail}
            selectedCustomerName={workspace.selectedCustomerName}
            subtotal={workspace.subtotal}
            total={workspace.total}
            discount={workspace.draft.discount}
            shippingFee={workspace.draft.shippingFee}
          />

          <OrderActionsPanel
            mode={mode}
            isEditing={workspace.isEditing}
            pendingAction={workspace.pendingAction}
            canPayCurrentOrder={workspace.actionFlags.canPayCurrentOrder}
            canApproveCurrentOrder={workspace.actionFlags.canApproveCurrentOrder}
            canExportCurrentOrder={workspace.actionFlags.canExportCurrentOrder}
            canSettleCurrentOrder={workspace.actionFlags.canSettleCurrentOrder}
            canCancelOrder={mode === 'detail' && workspace.order?.status !== 'CANCELLED'}
            onSave={workspace.handleSave}
            onCancelEdit={workspace.handleCancelEdit}
            onOpenPay={() => workspace.setShowPayModal(true)}
            onOpenApprove={() => workspace.setShowApproveModal(true)}
            onOpenExportStock={() => workspace.setShowExportStockModal(true)}
            onOpenSettle={() => workspace.setShowSettleModal(true)}
            onCancelOrder={() => {
              if (!window.confirm('Ban chac chan muon huy don hang nay?')) return
              workspace.cancelOrderMutation.mutate()
            }}
            onOpenPos={workspace.handleGoPos}
          />

          {mode === 'detail' ? (
            <OrderPaymentSummary
              paymentStatus={workspace.order?.paymentStatus}
              amountPaid={workspace.amountPaid}
              remainingAmount={workspace.remainingAmount}
            />
          ) : null}

          {mode === 'detail' ? <OrderTimeline timeline={workspace.timeline as any[]} /> : null}
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
            title="Thu tien don hang"
            description="Chon phuong thuc thanh toan cho don Orders."
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
            ? `Chon pet cho ${workspace.groomingServiceDraft.name}`
            : 'Chon thu cung'
        }
      />
    </PageContainer>
  )
}
