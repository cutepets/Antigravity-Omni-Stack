'use client'

import { useState } from 'react'
import {
  ArrowLeft,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  CreditCard,
  Loader2,
  Package,
  PencilLine,
  Printer,
  Save,
  Scissors,
  Search,
  User,
  XCircle,
} from 'lucide-react'
import { formatDateTime } from '@/lib/utils'
import { OrderStatusBadge } from './order-badges'
import type { OrderWorkspaceMode } from './order.types'

type StepState = 'pending' | 'active' | 'done' | 'alert'

interface ProgressStep {
  key: string
  label: string
  state: StepState
}

interface OrderTopBarProps {
  mode: OrderWorkspaceMode
  order?: any
  draft: any
  branches: any[]
  customerSearch: string
  customerResults: any[]
  selectedCustomerName: string
  isEditing: boolean
  pendingAction: boolean
  canEdit: boolean
  visibleProgressSteps: ProgressStep[]
  actionFlags: any
  onBack: () => void
  onEdit: () => void
  onSave: () => void
  onCancelEdit: () => void
  onBranchChange: (branchId?: string) => void
  onCustomerSearchChange: (value: string) => void
  onSelectCustomer: (customer: any) => void
  onClearCustomer: () => void
  onOpenPay: () => void
  onOpenApprove: () => void
  onOpenExportStock: () => void
  onOpenSettle: () => void
  onCancelOrder: () => void
  onOpenPos: () => void
  onPrintA4?: () => void
  onPrintK80?: () => void
  onPrintPdf?: () => void
}

export function OrderTopBar({
  mode,
  order,
  draft,
  branches,
  customerSearch,
  customerResults,
  selectedCustomerName,
  isEditing,
  pendingAction,
  canEdit,
  visibleProgressSteps,
  actionFlags,
  onBack,
  onEdit,
  onSave,
  onCancelEdit,
  onBranchChange,
  onCustomerSearchChange,
  onSelectCustomer,
  onClearCustomer,
  onOpenPay,
  onOpenApprove,
  onOpenExportStock,
  onOpenSettle,
  onCancelOrder,
  onOpenPos,
  onPrintA4,
  onPrintK80,
  onPrintPdf,
}: OrderTopBarProps) {
  const [showPrintMenu, setShowPrintMenu] = useState(false)

  const showPrintActions = mode === 'detail' && Boolean(order?.id)

  return (
    <div className="shrink-0 border-b border-border bg-background/80 backdrop-blur-sm">
      <div className="grid xl:grid-cols-[minmax(220px,1.1fr)_minmax(180px,0.9fr)_minmax(280px,1.4fr)_minmax(200px,auto)] items-stretch divide-x divide-border/70">

        {/* ── Cột 1: Back + Tiêu đề + Khách hàng ─────────────────────────── */}
        <div className="flex flex-col justify-center gap-1.5 px-5 py-4">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-background-secondary text-foreground-muted transition-colors hover:border-primary-500/40 hover:text-primary-500"
              title="Quay lại danh sách"
            >
              <ArrowLeft size={13} />
            </button>
            <div className="min-w-0">
              <div className="text-xs font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                {mode === 'create' ? 'Tạo đơn hàng mới' : 'Chi tiết đơn hàng'}
              </div>
              {mode === 'detail' && order?.orderNumber ? (
                <div className="truncate text-sm font-bold text-foreground">
                  {order.orderNumber}
                </div>
              ) : null}
            </div>
          </div>

          {/* Customer area */}
          <div className="mt-1">
            {draft.customerId ? (
              <div className="flex items-center justify-between gap-2 rounded-xl border border-border bg-background-secondary/60 px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <User size={13} className="shrink-0 text-primary-500" />
                  <span className="truncate text-sm font-semibold text-foreground">
                    {selectedCustomerName || 'Khách lẻ'}
                  </span>
                </div>
                {isEditing ? (
                  <button
                    type="button"
                    onClick={onClearCustomer}
                    className="shrink-0 text-foreground-muted transition-colors hover:text-error"
                    title="Xóa khách hàng"
                  >
                    <XCircle size={14} />
                  </button>
                ) : null}
              </div>
            ) : (
              <div className="relative">
                <Search
                  size={13}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-foreground-muted"
                />
                <input
                  type="text"
                  value={customerSearch}
                  disabled={!isEditing}
                  onChange={(event) => onCustomerSearchChange(event.target.value)}
                  placeholder="Tìm khách hàng..."
                  className="h-9 w-full rounded-xl border border-border bg-background pl-8 pr-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 focus:ring-1 focus:ring-primary-500/20 disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
                />
                {isEditing && customerSearch.trim().length >= 2 && customerResults.length > 0 ? (
                  <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-xl border border-border bg-background shadow-xl">
                    {customerResults.slice(0, 5).map((customer: any) => (
                      <button
                        key={customer.id}
                        type="button"
                        onClick={() => onSelectCustomer(customer)}
                        className="flex w-full items-center justify-between gap-3 border-b border-border/60 px-3 py-2.5 text-left text-sm transition-colors last:border-b-0 hover:bg-background-secondary"
                      >
                        <div>
                          <div className="font-semibold text-foreground text-sm">
                            {customer.fullName || customer.name}
                          </div>
                          <div className="text-xs text-foreground-muted">
                            {customer.phone || 'Không có SĐT'}
                          </div>
                        </div>
                        <User size={14} className="text-foreground-muted" />
                      </button>
                    ))}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* ── Cột 2: Mã đơn + Chi nhánh + Nhân viên ──────────────────────── */}
        <div className="flex flex-col justify-center gap-3 px-5 py-4">
          {mode === 'detail' ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Mã đơn
                </span>
                <span className="font-mono text-sm font-bold text-foreground">
                  {order?.orderNumber || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Ngày tạo
                </span>
                <span className="text-xs text-foreground-muted">
                  {formatDateTime(order?.createdAt)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Nhân viên
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {order?.staff?.fullName || order?.staff?.name || '—'}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                  Trạng thái
                </span>
                <OrderStatusBadge status={order?.status} />
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground-muted">
                Chi nhánh
              </div>
              <select
                value={draft.branchId ?? ''}
                disabled={!isEditing}
                onChange={(event) => onBranchChange(event.target.value || undefined)}
                className="h-9 w-full rounded-xl border border-border bg-background px-3 text-sm text-foreground outline-none transition-colors focus:border-primary-500 disabled:cursor-not-allowed disabled:bg-background-secondary disabled:text-foreground-muted"
              >
                <option value="">Chọn chi nhánh</option>
                {branches.map((branch: any) => (
                  <option key={branch.id} value={branch.id}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── Cột 3: Progress Stepper ──────────────────────────────────────── */}
        <div className="flex items-center px-6 py-4">
          <div className="flex w-full items-start justify-between">
            {visibleProgressSteps.map((step, index) => (
              <div
                key={`${step.key}-${index}`}
                className="relative flex flex-1 min-w-0 flex-col items-center justify-start gap-1.5 py-1 text-center"
              >
                <div className="relative flex w-full justify-center px-1">
                  <div
                    className={`relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[11px] font-bold ${
                      step.state === 'alert'
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
                      className={`absolute top-1/2 h-px -translate-y-1/2 ${
                        visibleProgressSteps[index + 1]?.state === 'alert'
                          ? 'bg-rose-500/35'
                          : step.state === 'done'
                            ? 'bg-primary-500/50'
                            : 'bg-border'
                      }`}
                      style={{ left: 'calc(50% + 18px)', right: 'calc(-50% + 18px)' }}
                    />
                  ) : null}
                </div>
                <div className="mt-0.5 text-[11px] font-semibold leading-tight text-center">
                  <span
                    className={
                      step.state === 'alert'
                        ? 'text-rose-300'
                        : step.state === 'active'
                          ? 'text-primary-500'
                          : step.state === 'done'
                            ? 'text-foreground'
                            : 'text-foreground-muted'
                    }
                  >
                    {step.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Cột 4: Actions ──────────────────────────────────────────────── */}
        <div className="flex flex-col items-end justify-center gap-2 px-5 py-4">
          {/* Save / Edit */}
          {isEditing ? (
            <button
              type="button"
              onClick={onSave}
              disabled={pendingAction}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-primary-500 px-4 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.2)] transition-opacity hover:opacity-90 disabled:opacity-60"
            >
              {pendingAction ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
              {mode === 'create' ? 'Tạo đơn hàng' : 'Lưu cập nhật'}
            </button>
          ) : mode === 'detail' && canEdit ? (
            <button
              type="button"
              onClick={onEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
            >
              <PencilLine size={14} />
              Chỉnh sửa
            </button>
          ) : null}

          {/* Cancel edit */}
          {mode === 'detail' && isEditing ? (
            <button
              type="button"
              onClick={onCancelEdit}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-border bg-background px-4 text-sm font-medium text-foreground-muted transition-colors hover:text-foreground"
            >
              <XCircle size={14} />
              Hủy sửa
            </button>
          ) : null}

          {/* Workflow actions */}
          <div className="flex flex-wrap justify-end gap-1.5">
            {actionFlags.canPayCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenPay}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <CreditCard size={13} />
                Thu tiền
              </button>
            ) : null}

            {actionFlags.canApproveCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenApprove}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <CheckSquare size={13} />
                Duyệt đơn
              </button>
            ) : null}

            {actionFlags.canExportCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenExportStock}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <Package size={13} />
                Xuất kho
              </button>
            ) : null}

            {actionFlags.canSettleCurrentOrder ? (
              <button
                type="button"
                onClick={onOpenSettle}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40 hover:text-primary-500"
              >
                <CheckCircle2 size={13} />
                Quyết toán
              </button>
            ) : null}

            {actionFlags.canCancelOrder ? (
              <button
                type="button"
                onClick={onCancelOrder}
                disabled={pendingAction}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-error/30 bg-error/8 px-3 text-xs font-medium text-error transition-colors hover:bg-error/15 disabled:opacity-60"
              >
                <XCircle size={13} />
                Hủy đơn
              </button>
            ) : null}

            {mode === 'create' ? (
              <button
                type="button"
                onClick={onOpenPos}
                className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40"
              >
                <Scissors size={13} />
                POS bán nhanh
              </button>
            ) : null}

            {showPrintActions ? (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowPrintMenu((current) => !current)}
                  className="inline-flex h-8 items-center gap-1 rounded-lg border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:border-primary-500/40"
                >
                  <Printer size={13} />
                  In đơn
                  <ChevronDown size={11} className={`transition-transform ${showPrintMenu ? 'rotate-180' : ''}`} />
                </button>
                {showPrintMenu ? (
                  <div className="absolute right-0 top-[calc(100%+4px)] z-50 w-40 overflow-hidden rounded-xl border border-border bg-background shadow-lg">
                    <button
                      type="button"
                      onClick={() => { setShowPrintMenu(false); onPrintA4?.() }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-background-secondary"
                    >
                      <Printer size={13} className="text-foreground-muted" />
                      In khổ A4
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPrintMenu(false); onPrintK80?.() }}
                      className="flex w-full items-center gap-2 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-background-secondary"
                    >
                      <Printer size={13} className="text-foreground-muted" />
                      In K80 (nhiệt)
                    </button>
                    <button
                      type="button"
                      onClick={() => { setShowPrintMenu(false); onPrintPdf?.() }}
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
        </div>
      </div>
    </div>
  )
}
