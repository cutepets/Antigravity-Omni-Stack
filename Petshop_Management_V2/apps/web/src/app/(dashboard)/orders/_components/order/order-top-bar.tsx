'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  ArrowLeftRight,
  CheckCircle2,
  CheckSquare,
  CreditCard,
  Loader2,
  Package,
  PencilLine,
  Save,
  Scissors,
  TriangleAlert,
  XCircle,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { OrderStatusBadge } from './order-badges'
import type { OrderWorkspaceMode } from './order.types'
import { OrderCustomerSection } from './OrderCustomerSection'

type StepState = 'pending' | 'active' | 'done' | 'alert'

interface ProgressStep {
  key: string
  label: string
  state: StepState
  meta?: string
}

interface OrderTopBarProps {
  mode: OrderWorkspaceMode
  order?: any
  draft: any
  customerSearch: string
  customerResults: any[]
  selectedCustomerName: string
  selectedCustomerPhone?: string
  selectedCustomerAddress?: string
  customerPoints?: number
  customerDebt?: number
  branchName: string
  showBranch?: boolean
  operatorName: string
  operatorCode?: string
  isEditing: boolean
  pendingAction: boolean
  canEdit: boolean
  visibleProgressSteps: ProgressStep[]
  actionFlags: any
  onBack: () => void
  onEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onCustomerSearchChange: (value: string) => void
  onSelectCustomer: (customer: any) => void
  onClearCustomer: () => void
  // Customer section props (passed down to OrderCustomerSection in TopBar)
  customerId?: string
  customerName?: string
  onRemoveCustomer: () => void
  onSelectSuggestedService?: (service: any, petId: string, petName?: string) => void
  onOpenPay: () => void

  onOpenExportStock: () => void
  onOpenSettle: () => void
  onOpenRefund: () => void
  onOpenReturn: () => void
  onCancelOrder: () => void
  onOpenPos: () => void
}

function InfoRow({
  label,
  value,
  valueClassName = 'text-sm font-semibold text-foreground',
}: {
  label: string
  value: string
  valueClassName?: string
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
        {label}
      </span>
      <span className={`text-right ${valueClassName}`}>{value}</span>
    </div>
  )
}

export function OrderTopBar({
  mode,
  order,
  draft,
  customerSearch,
  customerResults,
  selectedCustomerName,
  selectedCustomerPhone,
  selectedCustomerAddress,
  customerPoints,
  customerDebt,
  branchName,
  showBranch,
  operatorName,
  operatorCode,
  isEditing,
  pendingAction,
  canEdit,
  visibleProgressSteps,
  actionFlags,
  onBack,
  onEdit,
  onSave,
  onCancelEdit,
  onCustomerSearchChange,
  onSelectCustomer,
  onClearCustomer,
  onOpenPay,
  customerId,
  customerName,
  onRemoveCustomer,
  onSelectSuggestedService,

  onOpenExportStock,
  onOpenSettle,
  onOpenRefund,
  onOpenReturn,
  onCancelOrder,
  onOpenPos,
}: OrderTopBarProps) {
  const operatorLabel = operatorName

  return (
    <div className="relative z-30 shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="grid items-stretch divide-y divide-border/70 xl:grid-cols-[minmax(180px,0.7fr)_minmax(320px,1.6fr)_minmax(200px,0.85fr)_minmax(300px,1.4fr)_minmax(200px,auto)] xl:divide-x xl:divide-y-0">

        {/* Col 1: Back + Order title (1 line, above customer block) */}
        <div className="flex flex-col justify-center gap-1 px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground-muted">
            {mode === 'create' ? 'Tạo đơn hàng mới' : 'Chi tiết đơn hàng'}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground-muted transition-colors hover:border-primary-500/40 hover:text-primary-500"
            title="Quay lại danh sách"
          >
            <ArrowLeft size={13} />
          </button>
        </div>

        {/* Col 2: Customer + Pet — 2-card section */}
        <div className="flex min-h-0 flex-col justify-center">
          <OrderCustomerSection
            customerId={customerId}
            customerName={customerName}
            isEditing={isEditing}
            onSelectCustomer={(id, name) => onSelectCustomer({ id, fullName: name })}
            onRemoveCustomer={onRemoveCustomer}
            onSelectSuggestedService={isEditing ? onSelectSuggestedService : undefined}
          />
        </div>

        {/* Col 3: Nhân viên thao tác */}
        <div className="flex flex-col justify-center px-5 py-4">
          <div className="space-y-2.5">
            {showBranch !== false && <InfoRow label="Chi nhánh" value={branchName || '—'} />}
            <InfoRow label="Nhân viên thao tác" value={operatorLabel || '—'} />
            {mode === 'detail' ? (
              <>
                <InfoRow
                  label="Ngày tạo"
                  value={formatDateTime(order?.createdAt)}
                  valueClassName="text-xs text-foreground-muted"
                />
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                    Trạng thái
                  </span>
                  <OrderStatusBadge status={order?.status} />
                </div>
              </>
            ) : null}
          </div>
        </div>

        <div className="flex items-center px-6 py-4">
          <div className="flex w-full items-start justify-between gap-2">
            {visibleProgressSteps.map((step, index) => (
              <div
                key={`${step.key}-${index}`}
                className="relative flex min-w-0 flex-1 flex-col items-center justify-start gap-1 py-1 text-center"
              >
                <div className="relative flex w-full justify-center px-1">
                  <div
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${step.state === 'alert'
                      ? 'border-rose-500/50 bg-rose-500/12 text-rose-300'
                      : step.state === 'done' || step.state === 'active'
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
                        : step.state === 'done'
                          ? 'bg-primary-500/50'
                          : 'bg-border'
                        }`}
                      style={{ left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)' }}
                    />
                  ) : null}
                </div>
                <div className="mt-0.5 min-w-0">
                  <div
                    className={`text-[11px] font-semibold leading-tight ${step.state === 'alert'
                      ? 'text-rose-300'
                      : step.state === 'active'
                        ? 'text-primary-500'
                        : step.state === 'done'
                          ? 'text-foreground'
                          : 'text-foreground-muted'
                      }`}
                  >
                    {step.label}
                  </div>
                  <div className="mt-1 truncate text-[10px] text-foreground-muted">
                    {step.meta || '—'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col items-end justify-center gap-2 px-5 py-4">
          {mode === 'create' ? (
            <button
              type="button"
              onClick={onSave}
              disabled={pendingAction}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pendingAction ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              Tạo đơn hàng
            </button>
          ) : null}

          <div className="flex flex-wrap justify-end gap-2">
            {actionFlags.canPayCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenPay}
                className="btn-primary h-9 px-4 shadow-sm"
              >
                <CreditCard size={14} />
                Thu tiền
              </button>
            ) : null}


            {actionFlags.canExportCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenExportStock}
                className="btn-primary bg-sky-500 hover:bg-sky-600 text-white h-9 px-4 shadow-sm"
              >
                <Package size={14} />
                Xuất kho
              </button>
            ) : null}

            {actionFlags.canSettleCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenSettle}
                className="btn-outline border-orange-500/30 text-orange-600 hover:bg-orange-500/10 h-9 px-4"
              >
                <CheckCircle2 size={14} />
                Quyết toán
              </button>
            ) : null}


            {actionFlags.canReturnCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenReturn}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-amber-500/35 bg-amber-500/12 px-4 text-sm font-semibold text-amber-600 shadow-[0_10px_24px_rgba(245,158,11,0.12)] transition-colors hover:border-amber-400/55 hover:bg-amber-500/20"
              >
                <ArrowLeftRight size={14} />
                Đổi/trả
              </button>
            ) : null}

            {actionFlags.canCancelOrder ? (
              <button
                type="button"
                onClick={onCancelOrder}
                disabled={pendingAction}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-rose-500/35 bg-rose-500/12 px-4 text-sm font-semibold text-rose-300 shadow-[0_10px_24px_rgba(244,63,94,0.12)] transition-colors hover:border-rose-400/55 hover:bg-rose-500/20 disabled:opacity-60"
              >
                <XCircle size={14} />
                Hủy đơn
              </button>
            ) : null}

          </div>
        </div>
      </div>

    </div >
  )
}
