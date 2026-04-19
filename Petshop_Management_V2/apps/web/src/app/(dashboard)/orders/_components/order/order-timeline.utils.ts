// order-timeline.utils.ts
// Tách từ use-order-workspace.ts — toàn bộ logic xây dựng displayTimeline

import { buildFinanceVoucherHref } from '@/lib/finance-routes'

// ── Helpers ──────────────────────────────────────────────────────────────────

export function findTimelineActionTime(timeline: any[], actions: string[]) {
    return timeline.find((entry) => actions.includes(String(entry?.action ?? '').toUpperCase()))
        ?.createdAt
}

const AMOUNT_FORMATTER = new Intl.NumberFormat('vi-VN')

export function normalizeTimelineAction(action: unknown) {
    return String(action ?? '').trim().toUpperCase()
}

function formatTimelineAmount(amount: unknown) {
    const value = Number(amount ?? 0)
    if (!Number.isFinite(value) || value <= 0) return null
    return `${AMOUNT_FORMATTER.format(value)} đ`
}

function normalizeTaggedText(value: unknown) {
    return String(value ?? '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toUpperCase()
}

export function extractTaggedNote(notes: unknown, tag: string) {
    const line = String(notes ?? '')
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .find((entry) => normalizeTaggedText(entry).startsWith(normalizeTaggedText(tag)))

    if (!line) return undefined

    const reason = line.includes(']') ? line.slice(line.indexOf(']') + 1).trim() : line.trim()
    return reason || undefined
}

function formatTimelineParts(parts: Array<unknown>) {
    return parts
        .map((part) => String(part ?? '').trim())
        .filter(Boolean)
        .join(' • ')
}

function buildSearchHref(basePath: string, params: Record<string, string | null | undefined>) {
    const query = new URLSearchParams()
    Object.entries(params).forEach(([key, value]) => {
        if (!value) return
        query.set(key, value)
    })
    const search = query.toString()
    return search ? `${basePath}?${search}` : basePath
}

// ── Main Builder ─────────────────────────────────────────────────────────────

/**
 * Build the full displayTimeline by merging raw timeline entries with
 * synthetic entries derived from order data (payments, services, etc.)
 */
export function buildDisplayTimeline(
    mode: string,
    order: any,
    timeline: any[],
): any[] {
    if (mode !== 'detail' || !order) return timeline

    const baseTimeline = Array.isArray(timeline) ? timeline : []
    const hasAnyAction = (...actions: string[]) => {
        const normalized = actions.map((action) => normalizeTimelineAction(action))
        return baseTimeline.some((entry) => normalized.includes(normalizeTimelineAction(entry?.action)))
    }

    const syntheticEntries: any[] = []
    const createSyntheticEntry = (entry: Record<string, unknown>) => {
        syntheticEntries.push({
            orderId: order.id,
            fromStatus: null,
            toStatus: null,
            note: null,
            performedBy: order.staffId ?? '',
            performedByUser: {
                id: order.staffId ?? '',
                fullName: '',
                staffCode: '',
            },
            metadata: null,
            ...entry,
        })
    }

    // CREATED
    if (order.createdAt && !hasAnyAction('CREATED')) {
        createSyntheticEntry({
            id: `synthetic-created-${order.id}`,
            action: 'CREATED',
            createdAt: order.createdAt,
            toStatus: order.status ?? null,
            performedByUser: {
                id: order.staff?.id ?? order.staffId ?? '',
                fullName: order.staff?.fullName ?? '',
                staffCode: '',
            },
        })
    }

    // PAYMENT_ADDED
    const payments = Array.isArray(order.payments)
        ? [...order.payments].sort(
            (l, r) => new Date(r?.createdAt ?? 0).getTime() - new Date(l?.createdAt ?? 0).getTime(),
        )
        : []
    const paymentTransactions = Array.isArray(order.transactions)
        ? [...order.transactions]
            .filter((t: any) => t?.type === 'INCOME' && Number(t?.amount) > 0)
            .sort(
                (l, r) =>
                    new Date(r?.createdAt ?? r?.date ?? 0).getTime() -
                    new Date(l?.createdAt ?? l?.date ?? 0).getTime(),
            )
        : []

    if (!hasAnyAction('PAYMENT_ADDED', 'PAID', 'PAYMENT_CONFIRMED')) {
        if (paymentTransactions.length > 0) {
            paymentTransactions.forEach((transaction: any, index: number) => {
                const createdAt = transaction.createdAt ?? transaction.date ?? order.updatedAt ?? order.createdAt
                if (!createdAt) return
                createSyntheticEntry({
                    id: `synthetic-payment-transaction-${transaction.id ?? index}`,
                    action: 'PAYMENT_ADDED',
                    createdAt,
                    note: formatTimelineParts([
                        transaction.voucherNumber,
                        transaction.paymentAccountLabel ?? transaction.paymentMethod,
                        formatTimelineAmount(transaction.amount),
                    ]),
                    metadata: {
                        historyLink: transaction.voucherNumber
                            ? {
                                label: transaction.voucherNumber,
                                href: buildFinanceVoucherHref(transaction.voucherNumber),
                            }
                            : null,
                    },
                })
            })
        } else {
            payments.forEach((payment: any, index: number) => {
                if (!payment?.createdAt) return
                createSyntheticEntry({
                    id: `synthetic-payment-${payment.id ?? index}`,
                    action: 'PAYMENT_ADDED',
                    createdAt: payment.createdAt,
                    note: formatTimelineParts([
                        payment.paymentAccountLabel ?? payment.method,
                        formatTimelineAmount(payment.amount),
                        payment.note,
                    ]),
                })
            })
        }
    }

    // SERVICE_ADDED
    if (!hasAnyAction('SERVICE_ADDED')) {
        const seenServiceKeys = new Set<string>()
        const serviceItems = Array.isArray(order.items)
            ? [...order.items].sort(
                (l: any, r: any) =>
                    new Date(
                        r?.createdAt ?? r?.groomingSession?.createdAt ?? r?.hotelStay?.createdAt ?? 0,
                    ).getTime() -
                    new Date(
                        l?.createdAt ?? l?.groomingSession?.createdAt ?? l?.hotelStay?.createdAt ?? 0,
                    ).getTime(),
            )
            : []

        serviceItems.forEach((item: any, index: number) => {
            const groomingSession = item?.groomingSession
            const groomingId = item?.groomingSessionId ?? groomingSession?.id
            if (groomingId) {
                const sessionCode = groomingSession?.sessionCode || groomingId.slice(-6).toUpperCase()
                const serviceKey = `grooming:${groomingId}`
                if (seenServiceKeys.has(serviceKey)) return
                seenServiceKeys.add(serviceKey)

                const petSummary = [
                    item?.petName ?? groomingSession?.petName,
                    groomingSession?.weightAtBooking ? `${groomingSession.weightAtBooking}kg` : null,
                ]
                    .filter(Boolean)
                    .join(' ')

                createSyntheticEntry({
                    id: `synthetic-service-grooming-${groomingId}-${index}`,
                    action: 'SERVICE_ADDED',
                    createdAt: item?.createdAt ?? groomingSession?.createdAt ?? order.createdAt,
                    note: formatTimelineParts([
                        sessionCode,
                        item?.description ?? item?.name ?? groomingSession?.packageCode ?? 'Spa',
                        petSummary,
                    ]),
                    metadata: {
                        historyLink: {
                            label: sessionCode,
                            href: buildSearchHref('/grooming', {
                                view: 'list',
                                search: sessionCode || groomingId,
                                sessionId: groomingId,
                            }),
                        },
                    },
                })
                return
            }

            const hotelStay = item?.hotelStay
            const hotelStayId = item?.hotelStayId ?? hotelStay?.id
            if (!hotelStayId) return

            const stayCode = hotelStay?.stayCode || hotelStayId.slice(-6).toUpperCase()
            const serviceKey = `hotel:${hotelStayId}`
            if (seenServiceKeys.has(serviceKey)) return
            seenServiceKeys.add(serviceKey)

            createSyntheticEntry({
                id: `synthetic-service-hotel-${hotelStayId}-${index}`,
                action: 'SERVICE_ADDED',
                createdAt: item?.createdAt ?? hotelStay?.createdAt ?? order.createdAt,
                note: formatTimelineParts([
                    stayCode,
                    item?.description ?? item?.name ?? 'Khách sạn',
                    item?.petName ?? hotelStay?.petName,
                ]),
                metadata: {
                    historyLink: {
                        label: stayCode,
                        href: buildSearchHref('/hotel', {
                            view: 'list',
                            search: stayCode || hotelStayId,
                            stayId: hotelStayId,
                        }),
                    },
                },
            })
        })
    }

    // APPROVED
    if (order.approvedAt && !hasAnyAction('APPROVED')) {
        createSyntheticEntry({
            id: `synthetic-approved-${order.id}`,
            action: 'APPROVED',
            createdAt: order.approvedAt,
            fromStatus: 'PENDING',
            toStatus: 'CONFIRMED',
        })
    }

    // STOCK_EXPORTED
    if (order.stockExportedAt && !hasAnyAction('STOCK_EXPORTED')) {
        createSyntheticEntry({
            id: `synthetic-exported-${order.id}`,
            action: 'STOCK_EXPORTED',
            createdAt: order.stockExportedAt,
        })
    }

    // COMPLETED / SETTLED
    const isQuickOrder = !order.items?.some(
        (i: any) =>
            i.groomingSessionId || i.hotelStayId || i.type === 'grooming' || i.type === 'hotel',
    )
    const hasStockExported = hasAnyAction('STOCK_EXPORTED')

    if (order.settledAt && !hasAnyAction('SETTLED')) {
        createSyntheticEntry({
            id: `synthetic-settled-${order.id}`,
            action: 'SETTLED',
            createdAt: order.settledAt,
            toStatus: 'COMPLETED',
        })
    } else if (
        order.completedAt &&
        order.status === 'COMPLETED' &&
        !hasAnyAction('COMPLETED', 'SETTLED') &&
        !(isQuickOrder && hasStockExported)
    ) {
        createSyntheticEntry({
            id: `synthetic-completed-${order.id}`,
            action: 'COMPLETED',
            createdAt: order.completedAt,
            toStatus: 'COMPLETED',
        })
    }

    // REFUNDED
    if (
        ['PARTIALLY_REFUNDED', 'FULLY_REFUNDED'].includes(order.status ?? '') &&
        !hasAnyAction('REFUNDED')
    ) {
        createSyntheticEntry({
            id: `synthetic-refunded-${order.id}`,
            action: 'REFUNDED',
            createdAt: order.updatedAt ?? order.completedAt ?? order.createdAt,
            toStatus: order.status,
            note: extractTaggedNote(order.notes, '[HOAN TIEN]') ?? null,
        })
    }

    // CANCELLED
    if (order.status === 'CANCELLED' && !hasAnyAction('CANCELLED')) {
        createSyntheticEntry({
            id: `synthetic-cancelled-${order.id}`,
            action: 'CANCELLED',
            createdAt: order.updatedAt ?? order.createdAt,
            toStatus: 'CANCELLED',
            note: extractTaggedNote(order.notes, '[HUY]') ?? null,
        })
    }

    // Sort: newest first, then by action priority for same timestamp
    const ACTION_PRIORITY: Record<string, number> = {
        CREATED: 1,
        PAYMENT_ADDED: 2,
        PAID: 2,
        PAYMENT_CONFIRMED: 2,
        SERVICE_ADDED: 3,
        APPROVED: 4,
        STOCK_EXPORTED: 5,
        SETTLED: 6,
        COMPLETED: 7,
    }
    const getPriority = (action: string) => ACTION_PRIORITY[action] ?? 99

    return [...baseTimeline, ...syntheticEntries].sort((l, r) => {
        const timeDiff = new Date(r?.createdAt ?? 0).getTime() - new Date(l?.createdAt ?? 0).getTime()
        if (timeDiff !== 0) return timeDiff
        return getPriority(r?.action ?? '') - getPriority(l?.action ?? '')
    })
}
