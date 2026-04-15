'use client'

import { CheckCircle2, CheckSquare, CreditCard, Loader2, Package, Save, Scissors, XCircle } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'
import type { OrderWorkspaceMode } from './order.types'

interface OrderActionsPanelProps {
  mode: OrderWorkspaceMode
  isEditing: boolean
  pendingAction: boolean
  canPayCurrentOrder: boolean
  canApproveCurrentOrder: boolean
  canExportCurrentOrder: boolean
  canSettleCurrentOrder: boolean
  canCancelOrder: boolean
  onSave: () => void
  onCancelEdit: () => void
  onOpenPay: () => void
  onOpenApprove: () => void
  onOpenExportStock: () => void
  onOpenSettle: () => void
  onCancelOrder: () => void
  onOpenPos: () => void
}

export function OrderActionsPanel({
  mode,
  isEditing,
  pendingAction,
  canPayCurrentOrder,
  canApproveCurrentOrder,
  canExportCurrentOrder,
  canSettleCurrentOrder,
  canCancelOrder,
  onSave,
  onCancelEdit,
  onOpenPay,
  onOpenApprove,
  onOpenExportStock,
  onOpenSettle,
  onCancelOrder,
  onOpenPos,
}: OrderActionsPanelProps) {
  return (
    <PageContent className="space-y-4">
      <div className="text-base font-semibold text-foreground">Xu ly</div>
      <div className="grid gap-3">
        {isEditing ? (
          <button
            type="button"
            onClick={onSave}
            disabled={pendingAction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl bg-primary-500 px-4 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60"
          >
            {pendingAction ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {mode === 'create' ? 'Tao don hang' : 'Luu cap nhat'}
          </button>
        ) : null}

        {mode === 'detail' && isEditing ? (
          <button
            type="button"
            onClick={onCancelEdit}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <XCircle size={16} />
            Huy sua
          </button>
        ) : null}

        {canPayCurrentOrder ? (
          <button
            type="button"
            onClick={onOpenPay}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <CreditCard size={16} />
            Thu tien
          </button>
        ) : null}

        {canApproveCurrentOrder ? (
          <button
            type="button"
            onClick={onOpenApprove}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <CheckSquare size={16} />
            Duyet don
          </button>
        ) : null}

        {canExportCurrentOrder ? (
          <button
            type="button"
            onClick={onOpenExportStock}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <Package size={16} />
            Xuat kho
          </button>
        ) : null}

        {canSettleCurrentOrder ? (
          <button
            type="button"
            onClick={onOpenSettle}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <CheckCircle2 size={16} />
            Quyet toan
          </button>
        ) : null}

        {canCancelOrder ? (
          <button
            type="button"
            onClick={onCancelOrder}
            disabled={pendingAction}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-error/30 bg-error/10 px-4 text-sm font-medium text-error transition-colors hover:bg-error/20 disabled:opacity-60"
          >
            {pendingAction ? <Loader2 size={16} className="animate-spin" /> : <XCircle size={16} />}
            Huy don
          </button>
        ) : null}

        {mode === 'create' ? (
          <button
            type="button"
            onClick={onOpenPos}
            className="inline-flex h-11 items-center justify-center gap-2 rounded-2xl border border-border bg-background px-4 text-sm font-medium text-foreground transition-colors hover:border-primary-500/40"
          >
            <Scissors size={16} />
            Mo POS ban nhanh
          </button>
        ) : null}
      </div>
    </PageContent>
  )
}
