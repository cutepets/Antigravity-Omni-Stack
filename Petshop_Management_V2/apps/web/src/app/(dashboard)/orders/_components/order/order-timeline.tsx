'use client'

import { Calendar } from 'lucide-react'
import { PageContent } from '@/components/layout/PageLayout'
import { formatDateTime } from '@/lib/utils'
import { ORDER_ACTION_LABELS } from './order.constants'
import { OrderStatusBadge } from './order-badges'

interface OrderTimelineProps {
  timeline: any[]
}

export function OrderTimeline({ timeline }: OrderTimelineProps) {
  if (timeline.length === 0) return null

  return (
    <PageContent className="space-y-4">
      <div className="flex items-center gap-2 text-base font-semibold text-foreground">
        <Calendar size={18} className="text-primary-500" />
        Lich su phien ban
      </div>
      <div className="space-y-3">
        {timeline.map((entry: any) => (
          <div key={entry.id} className="rounded-2xl border border-border bg-background-secondary/60 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-foreground">
                  {ORDER_ACTION_LABELS[entry.action] ?? entry.action}
                </div>
                <div className="mt-1 text-xs text-foreground-muted">
                  {formatDateTime(entry.createdAt)} • {entry.performedByUser?.fullName ?? entry.performedByUser?.staffCode ?? '--'}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {entry.fromStatus ? <OrderStatusBadge status={entry.fromStatus} /> : null}
                {entry.toStatus ? <OrderStatusBadge status={entry.toStatus} /> : null}
              </div>
            </div>
            {entry.note ? <div className="mt-2 text-sm text-foreground-secondary">{entry.note}</div> : null}
          </div>
        ))}
      </div>
    </PageContent>
  )
}
