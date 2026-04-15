'use client'

import { User } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import { OrderStatusBadge } from './order-badges'
import type { OrderWorkspaceMode } from './order.types'

interface OrderOverviewPanelProps {
  mode: OrderWorkspaceMode
  order?: any
  branchName: string
  customerDetail?: any
  selectedCustomerName: string
  subtotal: number
  total: number
  discount: number
  shippingFee: number
}

export function OrderOverviewPanel({
  mode,
  order,
  branchName,
  customerDetail,
  selectedCustomerName,
  subtotal,
  total,
  discount,
  shippingFee,
}: OrderOverviewPanelProps) {
  return (
    <>
      <PageContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-base font-semibold text-foreground">Tong quan don hang</div>
            <div className="mt-1 text-sm text-foreground-muted">
              {mode === 'detail'
                ? `${branchName} • tao luc ${formatDateTime(order?.createdAt)}`
                : `${branchName} • luu tu workspace Orders`}
            </div>
          </div>
          {mode === 'detail' ? <OrderStatusBadge status={order?.status} /> : <span className="badge badge-info">Draft</span>}
        </div>

        <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Tam tinh</span>
            <span className="font-semibold text-foreground">{formatCurrency(subtotal)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Chiet khau</span>
            <span className="font-semibold text-foreground">{formatCurrency(discount)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-foreground-muted">Phi ship</span>
            <span className="font-semibold text-foreground">{formatCurrency(shippingFee)}</span>
          </div>
          <div className="mt-3 flex items-center justify-between border-t border-border pt-3">
            <span className="text-sm font-semibold text-foreground">Tong thanh toan</span>
            <span className="text-xl font-bold text-primary-500">{formatCurrency(total)}</span>
          </div>
        </div>
      </PageContent>

      {mode === 'detail' ? (
        <PageContent className="space-y-4">
          <div className="text-base font-semibold text-foreground">Thong tin khach hang</div>
          <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-500/10 text-primary-500">
                <User size={18} />
              </div>
              <div className="min-w-0">
                <div className="text-sm font-semibold text-foreground">{selectedCustomerName || 'Khach le'}</div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {[customerDetail?.phone, customerDetail?.address].filter(Boolean).join(' • ') ||
                    'Khong co thong tin lien he'}
                </div>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
            <div className="grid gap-2 text-sm text-foreground-secondary">
              <div className="flex items-center justify-between gap-3">
                <span>Ma don</span>
                <span className="font-mono font-semibold text-foreground">{order?.orderNumber || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Nguoi tao</span>
                <span className="font-semibold text-foreground">{order?.staff?.fullName || order?.staff?.name || '--'}</span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span>Chi nhanh</span>
                <span className="font-semibold text-foreground">{branchName}</span>
              </div>
            </div>
          </div>
        </PageContent>
      ) : null}
    </>
  )
}
