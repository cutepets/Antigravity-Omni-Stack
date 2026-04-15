'use client'

import { PageContent } from '@/components/layout/PageLayout'
import { formatCurrency } from '@/lib/utils'
import { PaymentStatusBadge } from './order-badges'

interface OrderPaymentSummaryProps {
  paymentStatus?: string
  amountPaid: number
  remainingAmount: number
}

export function OrderPaymentSummary({
  paymentStatus,
  amountPaid,
  remainingAmount,
}: OrderPaymentSummaryProps) {
  return (
    <PageContent className="space-y-4">
      <div className="text-base font-semibold text-foreground">Trang thai thanh toan</div>
      <div className="rounded-2xl border border-border bg-background-secondary/70 p-4">
        <div className="flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Trang thai</span>
          <PaymentStatusBadge status={paymentStatus} />
        </div>
        <div className="mt-3 flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Da thu</span>
          <span className="font-semibold text-success">{formatCurrency(amountPaid)}</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-sm">
          <span className="text-foreground-muted">Con lai</span>
          <span className="font-semibold text-warning">{formatCurrency(remainingAmount)}</span>
        </div>
      </div>
    </PageContent>
  )
}
