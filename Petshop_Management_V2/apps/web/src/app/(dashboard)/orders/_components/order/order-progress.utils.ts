// order-progress.utils.ts
// Tách từ use-order-workspace.ts — logic xây dựng visibleProgressSteps

import { formatDateTime } from '@/lib/utils'
import { findTimelineActionTime } from './order-timeline.utils'

export type ProgressStepState = 'done' | 'active' | 'pending' | 'alert'

export type OrderProgressStep = {
    key: string
    label: string
    meta: string
    state: ProgressStepState
}

/**
 * Build the 3-step progress bar (Tạo đơn → Thanh toán → Xuất kho)
 * from order data and the display timeline.
 */
export function buildVisibleProgressSteps(
    mode: string,
    order: any,
    displayTimeline: any[],
): OrderProgressStep[] {
    const currentStatus = order?.status ?? (mode === 'create' ? 'DRAFT' : undefined)
    const isPaid = (order?.paidAmount ?? 0) > 0 || ['PAID', 'COMPLETED'].includes(order?.paymentStatus ?? '')
    const isExported = Boolean(order?.stockExportedAt)
    const isCompleted = currentStatus === 'COMPLETED'
    const isCancelled = currentStatus === 'CANCELLED'

    // QUICK order (pure product orders): hide Hoàn thành step
    const isQuickOrder =
        mode === 'detail' &&
        !order?.items?.some(
            (i: any) => i.groomingSessionId || i.hotelStayId || i.type === 'grooming' || i.type === 'hotel',
        )

    // Stage: 0=draft, 1=paid, 2=exported, 3=completed
    const rawStage = isCompleted ? 3 : isExported ? 2 : isPaid ? 1 : 0
    const currentStage = isQuickOrder ? Math.min(rawStage, 2) : rawStage

    const latestPaymentAt = Array.isArray(order?.payments)
        ? [...order.payments].sort(
            (l: any, r: any) =>
                new Date(r?.createdAt ?? 0).getTime() - new Date(l?.createdAt ?? 0).getTime(),
        )[0]?.createdAt
        : undefined

    const paidAt =
        latestPaymentAt ??
        findTimelineActionTime(displayTimeline, ['PAID', 'PAYMENT_CONFIRMED', 'PAYMENT_ADDED', 'APPROVED'])
    const exportedAt =
        order?.stockExportedAt ?? findTimelineActionTime(displayTimeline, ['STOCK_EXPORTED'])
    const completedAt =
        order?.completedAt ??
        order?.settledAt ??
        findTimelineActionTime(displayTimeline, ['COMPLETED', 'SETTLED'])

    const stepMetas: Record<string, string | undefined> = {
        DRAFT: order?.createdAt,
        PAID: paidAt,
        EXPORTED: exportedAt,
        COMPLETED: completedAt,
    }

    const allSteps = [
        { key: 'DRAFT', label: 'Tạo đơn', idx: 0 },
        { key: 'PAID', label: 'Thanh toán', idx: 1 },
        { key: 'EXPORTED', label: 'Xuất kho', idx: 2 },
    ]

    return allSteps.map(({ key, label, idx }) => {
        const metaTime = stepMetas[key]
        const meta = metaTime ? formatDateTime(metaTime) : '—'
        if (isCancelled) return { key, label, meta, state: 'alert' as const }
        if (idx < currentStage) return { key, label, meta, state: 'done' as const }
        if (idx === currentStage) return { key, label, meta, state: 'active' as const }
        return { key, label, meta, state: 'pending' as const }
    })
}
