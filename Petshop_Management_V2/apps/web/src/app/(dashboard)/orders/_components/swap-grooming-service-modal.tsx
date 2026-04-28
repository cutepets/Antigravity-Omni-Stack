'use client'

import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeftRight, Loader2, Scissors, X } from 'lucide-react'
import { toast } from 'sonner'
import { usePetPricingSuggestions } from '@/app/(dashboard)/pos/_hooks/use-pos-queries'
import { money, moneyRaw } from '@/app/(dashboard)/_shared/payment/payment.utils'
import { petApi } from '@/lib/api/pet.api'
import { orderApi } from '@/lib/api/order.api'
import { settingsApi } from '@/lib/api/settings.api'
import { filterVisiblePaymentMethods } from '@/lib/payment-methods'

type SwapGroomingServiceModalProps = {
    isOpen: boolean
    onClose: () => void
    orderId: string
    itemId: string
    branchId?: string
    orderTotal: number
    amountPaid: number
    itemDescription: string
    currentUnitPrice: number
    quantity: number
    discountItem: number
    petId?: string
    petName?: string
    pricingRuleId?: string
    packageCode?: string
    sessionId?: string | null
}

export function SwapGroomingServiceModal({
    isOpen,
    onClose,
    orderId,
    itemId,
    branchId,
    orderTotal,
    amountPaid,
    itemDescription,
    currentUnitPrice,
    quantity,
    discountItem,
    petId,
    petName,
    pricingRuleId,
    packageCode,
    sessionId,
}: SwapGroomingServiceModalProps) {
    const queryClient = useQueryClient()
    const [selectedPricingRuleId, setSelectedPricingRuleId] = useState<string>('')
    const [refundPaymentMethodId, setRefundPaymentMethodId] = useState<string>('')
    const [note, setNote] = useState('')

    const { data: pet, isLoading: petLoading } = useQuery({
        queryKey: ['pet', petId],
        queryFn: () => petApi.getPet(petId!),
        enabled: isOpen && Boolean(petId),
        staleTime: 60_000,
    })

    const { data: suggestions = [], isLoading: suggestionsLoading } = usePetPricingSuggestions(pet)

    const { data: paymentMethods = [] } = useQuery({
        queryKey: ['settings', 'payment-methods'],
        queryFn: () => settingsApi.getPaymentMethods(),
        enabled: isOpen,
        staleTime: 60_000,
    })

    const candidates = useMemo(
        () =>
            suggestions.filter((entry: any) => {
                const role = entry.serviceRole ?? entry.pricingSnapshot?.serviceRole ?? 'MAIN'
                const group = entry.suggestionGroup ?? 'PRIMARY'
                const ruleId = entry.pricingRuleId ?? entry.pricingSnapshot?.pricingRuleId
                return (
                    entry.type === 'grooming'
                    && role !== 'EXTRA'
                    && group !== 'OTHER'
                    && Boolean(ruleId)
                    && ruleId !== pricingRuleId
                )
            }),
        [pricingRuleId, suggestions],
    )

    const selectedCandidate = useMemo(
        () => candidates.find((entry: any) => (entry.pricingRuleId ?? entry.pricingSnapshot?.pricingRuleId) === selectedPricingRuleId) ?? null,
        [candidates, selectedPricingRuleId],
    )

    const currentLineTotal = Math.max(0, currentUnitPrice * quantity - discountItem)
    const selectedGross = Math.max(0, Number(selectedCandidate?.price ?? 0) * quantity)
    const selectedDiscount = Math.min(discountItem, selectedGross)
    const selectedLineTotal = Math.max(0, selectedGross - selectedDiscount)
    const projectedTotal = Math.max(0, orderTotal - currentLineTotal + selectedLineTotal)
    const overpaidAmount = Math.max(0, amountPaid - projectedTotal)

    const visiblePaymentMethods = useMemo(
        () =>
            filterVisiblePaymentMethods(paymentMethods, {
                branchId,
                amount: overpaidAmount,
                selectedId: refundPaymentMethodId || null,
            }),
        [branchId, overpaidAmount, paymentMethods, refundPaymentMethodId],
    )

    useEffect(() => {
        if (!isOpen) return
        setSelectedPricingRuleId('')
        setRefundPaymentMethodId('')
        setNote('')
    }, [isOpen, itemId])

    useEffect(() => {
        if (overpaidAmount <= 0) {
            setRefundPaymentMethodId('')
            return
        }
        if (!refundPaymentMethodId && visiblePaymentMethods.length > 0) {
            setRefundPaymentMethodId(visiblePaymentMethods[0].id)
        }
    }, [overpaidAmount, refundPaymentMethodId, visiblePaymentMethods])

    const swapMutation = useMutation({
        mutationFn: async () => {
            if (!selectedCandidate) {
                throw new Error('Vui long chon goi dich vu muon doi')
            }

            const selectedRefundMethod = visiblePaymentMethods.find((method) => method.id === refundPaymentMethodId)

            if (overpaidAmount > 0 && !selectedRefundMethod) {
                throw new Error('Vui long chon phuong thuc hoan tien')
            }

            return orderApi.swapGroomingService(orderId, itemId, {
                targetPricingRuleId: selectedCandidate.pricingRuleId ?? (selectedCandidate as any).pricingSnapshot?.pricingRuleId,
                refundMethod: selectedRefundMethod?.type,
                refundPaymentAccountId: selectedRefundMethod?.id,
                refundPaymentAccountLabel: selectedRefundMethod?.name,
                note: note.trim() || undefined,
            })
        },
        onSuccess: (updatedOrder) => {
            toast.success('Da doi goi SPA')
            queryClient.setQueriesData({ predicate: (query) => query.queryKey[0] === 'order' }, (previous) => {
                if (!previous || typeof previous !== 'object') return previous
                const cachedOrder = previous as Record<string, any>
                const cachedId = String(cachedOrder.id ?? '')
                const cachedNumber = String(cachedOrder.orderNumber ?? '')
                const nextId = String((updatedOrder as any)?.id ?? '')
                const nextNumber = String((updatedOrder as any)?.orderNumber ?? '')

                if (!nextId && !nextNumber) return previous
                if (cachedId === nextId || cachedId === nextNumber || cachedNumber === nextId || cachedNumber === nextNumber) {
                    return updatedOrder
                }
                return previous
            })
            void queryClient.invalidateQueries({ queryKey: ['orders'] })
            void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'order' })
            void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'order-timeline' })
            void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'order-payment-intents' })
            void queryClient.invalidateQueries({ queryKey: ['grooming-sessions'] })
            void queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'grooming-session' })
            if (sessionId) {
                void queryClient.invalidateQueries({ queryKey: ['grooming-session', sessionId] })
            }
            onClose()
        },
        onError: (error: any) => {
            const message = error?.response?.data?.message ?? error?.message ?? 'Khong the doi goi SPA'
            toast.error(message)
        },
    })

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-999 flex items-center justify-center app-modal-overlay"
            onClick={(event) => {
                if (event.target === event.currentTarget && !swapMutation.isPending) onClose()
            }}
        >
            <div className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-border bg-background shadow-2xl">
                <div className="flex items-center justify-between border-b border-border px-6 py-4">
                    <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary-500/12 text-primary-600">
                            <ArrowLeftRight size={18} />
                        </div>
                        <div>
                            <h2 className="text-lg font-semibold text-foreground">Doi goi dich vu SPA</h2>
                            <p className="text-sm text-foreground-muted">
                                {petName || pet?.name || 'Thu cung'} · {itemDescription}
                            </p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={swapMutation.isPending}
                        className="rounded-xl p-2 text-foreground-muted transition-colors hover:bg-background-secondary hover:text-foreground"
                    >
                        <X size={18} />
                    </button>
                </div>

                <div className="grid gap-6 overflow-y-auto px-6 py-5 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-background-secondary/40 p-4">
                            <div className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-foreground-muted">
                                Goi hien tai
                            </div>
                            <div className="flex items-start justify-between gap-4">
                                <div>
                                    <div className="text-lg font-semibold text-foreground">{itemDescription}</div>
                                    <div className="mt-1 text-sm text-foreground-muted">
                                        {packageCode ? `Ma goi: ${packageCode}` : 'Khong co packageCode'}
                                    </div>
                                </div>
                                <div className="text-right">
                                    <div className="text-sm text-foreground-muted">{money(currentUnitPrice)} x {quantity}</div>
                                    <div className="text-lg font-bold text-foreground">{money(currentLineTotal)}</div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground-muted">
                                Chon goi moi
                            </div>
                            {petLoading || suggestionsLoading ? (
                                <div className="flex items-center justify-center rounded-2xl border border-border bg-background-secondary/30 px-4 py-10 text-foreground-muted">
                                    <Loader2 size={18} className="mr-2 animate-spin" />
                                    Dang tai bang gia SPA...
                                </div>
                            ) : !petId ? (
                                <div className="rounded-2xl border border-amber-500/20 bg-amber-500/8 px-4 py-3 text-sm text-amber-600">
                                    Khong xac dinh duoc thu cung cua dong SPA nay.
                                </div>
                            ) : candidates.length === 0 ? (
                                <div className="rounded-2xl border border-border bg-background-secondary/30 px-4 py-6 text-sm text-foreground-muted">
                                    Khong tim thay goi SPA chinh phu hop de doi.
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {candidates.map((entry: any) => {
                                        const entryRuleId = entry.pricingRuleId ?? entry.pricingSnapshot?.pricingRuleId
                                        const entryGross = Math.max(0, Number(entry.price ?? 0) * quantity)
                                        const entryDiscount = Math.min(discountItem, entryGross)
                                        const entryTotal = Math.max(0, entryGross - entryDiscount)
                                        const isActive = entryRuleId === selectedPricingRuleId

                                        return (
                                            <button
                                                key={entryRuleId}
                                                type="button"
                                                onClick={() => setSelectedPricingRuleId(entryRuleId)}
                                                className={[
                                                    'w-full rounded-2xl border px-4 py-3 text-left transition-colors',
                                                    isActive
                                                        ? 'border-primary-500 bg-primary-500/8'
                                                        : 'border-border bg-background-secondary/20 hover:border-primary-500/35 hover:bg-primary-500/5',
                                                ].join(' ')}
                                            >
                                                <div className="flex items-start justify-between gap-4">
                                                    <div className="min-w-0">
                                                        <div className="flex items-center gap-2">
                                                            <Scissors size={15} className="text-primary-500" />
                                                            <span className="truncate text-sm font-semibold text-foreground">{entry.name}</span>
                                                        </div>
                                                        <div className="mt-1 text-xs text-foreground-muted">
                                                            {entry.weightBandLabel || entry.pricingSnapshot?.weightBandLabel || 'Khong gioi han hang can'}
                                                        </div>
                                                        {entry.reason && (
                                                            <div className="mt-1 text-xs text-foreground-muted">{entry.reason}</div>
                                                        )}
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="text-sm font-semibold text-foreground">{money(Number(entry.price ?? 0))}</div>
                                                        <div className="text-xs text-foreground-muted">Thanh tien: {money(entryTotal)}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        )
                                    })}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div className="rounded-2xl border border-border bg-background-secondary/40 p-4">
                            <div className="text-xs font-semibold uppercase tracking-[0.24em] text-foreground-muted">
                                Du kien sau khi doi
                            </div>
                            <div className="mt-4 space-y-2 text-sm">
                                <div className="flex items-center justify-between text-foreground-muted">
                                    <span>Dich vu hien tai</span>
                                    <span>{money(currentLineTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-foreground-muted">
                                    <span>Dich vu moi</span>
                                    <span>{selectedCandidate ? money(selectedLineTotal) : '--'}</span>
                                </div>
                                <div className="flex items-center justify-between text-foreground-muted">
                                    <span>Da thu</span>
                                    <span>{money(amountPaid)}</span>
                                </div>
                                <div className="flex items-center justify-between border-t border-border pt-2 text-foreground">
                                    <span>Tong don moi</span>
                                    <span className="font-semibold">{money(projectedTotal)}</span>
                                </div>
                                <div className="flex items-center justify-between text-foreground">
                                    <span>Chenh lech dong SPA</span>
                                    <span className={selectedLineTotal < currentLineTotal ? 'text-emerald-500' : 'text-primary-600'}>
                                        {selectedCandidate ? `${selectedLineTotal >= currentLineTotal ? '+' : ''}${moneyRaw(selectedLineTotal - currentLineTotal)}` : '--'}
                                    </span>
                                </div>
                            </div>
                            <div className="mt-3 rounded-xl bg-background px-3 py-2 text-xs text-foreground-muted">
                                Gia va chiet khau se khoa o phieu SPA. Neu can sua so tien, thao tac tai don POS.
                            </div>
                        </div>

                        {overpaidAmount > 0 && (
                            <div className="rounded-2xl border border-amber-500/25 bg-amber-500/8 p-4">
                                <div className="text-sm font-semibold text-amber-700">Can hoan tien chenh lech</div>
                                <div className="mt-1 text-xs text-amber-600">
                                    Don se du {money(overpaidAmount)} sau khi doi goi. Chon phuong thuc hoan tien de tiep tuc.
                                </div>
                                <div className="mt-3 space-y-2">
                                    {visiblePaymentMethods.map((method) => (
                                        <label
                                            key={method.id}
                                            className={[
                                                'flex cursor-pointer items-center justify-between rounded-xl border px-3 py-2 text-sm transition-colors',
                                                refundPaymentMethodId === method.id
                                                    ? 'border-amber-500 bg-white'
                                                    : 'border-amber-500/20 bg-white/70 hover:border-amber-500/40',
                                            ].join(' ')}
                                        >
                                            <span>{method.name}</span>
                                            <input
                                                type="radio"
                                                name="refund-method"
                                                checked={refundPaymentMethodId === method.id}
                                                onChange={() => setRefundPaymentMethodId(method.id)}
                                            />
                                        </label>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="rounded-2xl border border-border bg-background-secondary/40 p-4">
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-[0.24em] text-foreground-muted">
                                Ghi chu
                            </label>
                            <textarea
                                value={note}
                                onChange={(event) => setNote(event.target.value)}
                                rows={4}
                                placeholder="Ghi chu ly do doi goi neu can..."
                                className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary-500"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-end gap-3 border-t border-border px-6 py-4">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={swapMutation.isPending}
                        className="rounded-2xl border border-border bg-background-secondary px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-background-tertiary disabled:opacity-60"
                    >
                        Dong
                    </button>
                    <button
                        type="button"
                        onClick={() => swapMutation.mutate()}
                        disabled={!selectedCandidate || swapMutation.isPending || (overpaidAmount > 0 && !refundPaymentMethodId)}
                        className="inline-flex items-center gap-2 rounded-2xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white shadow-[0_10px_28px_rgba(6,182,212,0.28)] transition-colors hover:bg-primary-600 disabled:opacity-60"
                    >
                        {swapMutation.isPending ? <Loader2 size={16} className="animate-spin" /> : <ArrowLeftRight size={16} />}
                        Xac nhan doi
                    </button>
                </div>
            </div>
        </div>
    )
}
