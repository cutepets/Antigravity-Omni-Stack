/**
 * use-pos-payment — Payment & checkout hook for POS.
 *
 * Encapsulates:
 *   - Payment method selection (single / multi)
 *   - Customer cash input + change calculation
 *   - Quick cash suggestions
 *   - Checkout flow (cash, bank, unpaid, service → new tab)
 *   - QR payment modal state + intent generation
 *   - Receipt modal state
 */

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import type { PaymentEntry } from '@petshop/shared';
import type { CreateOrderPayload, OrderPaymentIntent } from '@/lib/api/order.api';
import { orderApi } from '@/lib/api/order.api';
import { settingsApi } from '@/lib/api/settings.api';
import { filterVisiblePaymentMethods } from '@/lib/payment-methods';
import { money, parseMoneyInputValue, buildQuickCashSuggestions } from '@/app/(dashboard)/_shared/payment/payment.utils';
import { resolveCartItemStockState } from '@/app/(dashboard)/_shared/cart/stock.utils';
import { usePaymentIntentStream } from '@/hooks/use-payment-intent-stream';
import { usePosStore, useActiveTab, useCartTotal, useCartSubtotal } from '@/stores/pos.store';
import { useCreateOrder } from './use-pos-mutations';

export function usePosPayment() {
    const queryClient = useQueryClient();
    const store = usePosStore();
    const activeTab = useActiveTab();
    const cartTotal = useCartTotal();
    const cartSubtotal = useCartSubtotal();
    const createOrder = useCreateOrder();

    // ── Modal visibility ───────────────────────────────────────────────────────
    const [showPaymentModal, setShowPaymentModal] = useState(false);
    const [showQrPaymentModal, setShowQrPaymentModal] = useState(false);
    const [showBookingModal, setShowBookingModal] = useState(false);
    const [showReceiptModal, setShowReceiptModal] = useState(false);

    // ── Payment input state ────────────────────────────────────────────────────
    const [customerMoneyInput, setCustomerMoneyInput] = useState('');
    const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
    const paymentMenuRef = useRef<HTMLDivElement | null>(null);
    const autoCashSeedRef = useRef<number | null>(null);

    // ── QR intent state ────────────────────────────────────────────────────────
    const [activeQrIntent, setActiveQrIntent] = useState<OrderPaymentIntent | null>(null);
    const [isQrIntentPending, setIsQrIntentPending] = useState(false);
    const handledQrPaidCodeRef = useRef<string | null>(null);

    // ── Settings queries ───────────────────────────────────────────────────────
    const { data: paymentMethods = [] } = useQuery({
        queryKey: ['settings', 'payment-methods'],
        queryFn: () => settingsApi.getPaymentMethods(),
        staleTime: 30_000,
    });
    const { data: paymentOptions } = useQuery({
        queryKey: ['settings', 'payment-options'],
        queryFn: () => settingsApi.getPaymentOptions(),
        staleTime: 30_000,
    });

    const activeBranchId = activeTab?.branchId;

    // ── Derived: visible methods, preferred, tab-level payments ───────────────
    const visiblePaymentMethods = useMemo(
        () => filterVisiblePaymentMethods(paymentMethods, { branchId: activeBranchId, amount: cartTotal }),
        [activeBranchId, cartTotal, paymentMethods],
    );

    const preferredPaymentMethod = useMemo(() => {
        const selectedId = activeTab?.payments?.[0]?.paymentAccountId;
        if (selectedId) {
            return (
                visiblePaymentMethods.find((m) => m.id === selectedId) ??
                paymentMethods.find((m) => m.id === selectedId) ??
                null
            );
        }
        return (
            visiblePaymentMethods.find((m) => m.id === store.defaultPayment) ??
            visiblePaymentMethods.find((m) => m.isDefault) ??
            visiblePaymentMethods[0] ??
            null
        );
    }, [activeTab?.payments, paymentMethods, store.defaultPayment, visiblePaymentMethods]);

    const allowMultiPayment = Boolean(paymentOptions?.allowMultiPayment);
    const tabPayments = useMemo(() => activeTab?.payments ?? [], [activeTab?.payments]);
    const isMultiPaymentSummary = tabPayments.length > 1;
    const selectedSinglePayment = tabPayments.length === 1 ? tabPayments[0] : null;

    const currentSinglePaymentMethod =
        selectedSinglePayment?.paymentAccountId
            ? visiblePaymentMethods.find((m) => m.id === selectedSinglePayment.paymentAccountId) ??
            paymentMethods.find((m) => m.id === selectedSinglePayment.paymentAccountId) ??
            preferredPaymentMethod
            : preferredPaymentMethod;

    const currentSinglePaymentType = currentSinglePaymentMethod?.type ?? selectedSinglePayment?.method ?? 'CASH';

    const currentSinglePaymentAmount =
        currentSinglePaymentType === 'CASH'
            ? parseMoneyInputValue(customerMoneyInput || money(cartTotal))
            : cartTotal;

    const isQrBankPayment =
        !isMultiPaymentSummary &&
        currentSinglePaymentMethod?.type === 'BANK' &&
        Boolean(currentSinglePaymentMethod.qrEnabled);

    const guestMoney = currentSinglePaymentType === 'CASH' ? currentSinglePaymentAmount : cartTotal;
    const returnMoney = currentSinglePaymentType === 'CASH' && guestMoney > cartTotal ? guestMoney - cartTotal : 0;
    const multiPaymentTotal = tabPayments.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const hasServiceItems =
        activeTab?.cart.some(
            (item) => item.type === 'service' || item.type === 'hotel' || item.type === 'grooming' || item.groomingDetails || item.hotelDetails,
        ) || false;

    const quickCashSuggestions = useMemo(() => buildQuickCashSuggestions(cartTotal), [cartTotal]);

    // ── Auto-seed cash input ───────────────────────────────────────────────────
    useEffect(() => {
        if (!activeTab || isMultiPaymentSummary || currentSinglePaymentType !== 'CASH') return;
        const parsedCurrent = parseMoneyInputValue(customerMoneyInput);
        const previousSeed = autoCashSeedRef.current;
        const shouldSeed = !customerMoneyInput || (previousSeed !== null && parsedCurrent === previousSeed);
        if (shouldSeed) setCustomerMoneyInput(cartTotal > 0 ? money(cartTotal) : '');
        autoCashSeedRef.current = cartTotal;
    }, [activeTab, cartTotal, currentSinglePaymentType, customerMoneyInput, isMultiPaymentSummary]);

    // ── Close payment menu on outside click ───────────────────────────────────
    useEffect(() => {
        if (!isPaymentMenuOpen) return;
        const handler = (e: MouseEvent) => {
            if (paymentMenuRef.current && !paymentMenuRef.current.contains(e.target as Node)) {
                setIsPaymentMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isPaymentMenuOpen]);

    // ── QR intent stream ───────────────────────────────────────────────────────
    const qrIntentStream = usePaymentIntentStream(activeQrIntent?.code, showQrPaymentModal && Boolean(activeQrIntent?.code));

    useEffect(() => {
        if (!qrIntentStream.latestIntent || !activeQrIntent) return;
        if (qrIntentStream.latestIntent.code !== activeQrIntent.code) return;
        setActiveQrIntent(qrIntentStream.latestIntent);
        if (qrIntentStream.lastEvent !== 'paid') return;
        if (handledQrPaidCodeRef.current === qrIntentStream.latestIntent.code) return;
        handledQrPaidCodeRef.current = qrIntentStream.latestIntent.code;
        toast.success('Đã nhận thông báo chuyển khoản thành công');
        if (qrIntentStream.latestIntent.orderId) {
            void queryClient.invalidateQueries({ queryKey: ['order', qrIntentStream.latestIntent.orderId] });
            void queryClient.invalidateQueries({ queryKey: ['order-payment-intents', qrIntentStream.latestIntent.orderId] });
        }
        void queryClient.invalidateQueries({ queryKey: ['orders'] });
        if (qrIntentStream.latestIntent.order) {
            store.attachLinkedOrder({
                orderId: qrIntentStream.latestIntent.order.id,
                orderNumber: qrIntentStream.latestIntent.order.orderNumber,
                paymentStatus: 'PAID',
                amountPaid: qrIntentStream.latestIntent.order.paidAmount ?? qrIntentStream.latestIntent.amount,
                branchId: activeTab?.branchId,
            });
        }
    }, [activeQrIntent, activeTab?.branchId, qrIntentStream, queryClient, store]);

    // ── Handlers: select payment method ───────────────────────────────────────
    const handleSelectSinglePaymentMethod = useCallback(
        (method: (typeof paymentMethods)[number]) => {
            store.setSinglePayment(method.type as any, cartTotal, {
                paymentAccountId: method.id,
                paymentAccountLabel: method.name,
            });
            if (method.type === 'CASH') {
                setCustomerMoneyInput(money(cartTotal));
                autoCashSeedRef.current = cartTotal;
            }
            setIsPaymentMenuOpen(false);
        },
        [cartTotal, store],
    );

    const handleMultiPaymentConfirm = useCallback(
        (payload: { payments: Array<{ method: string; amount: number; paymentAccountId?: string; paymentAccountLabel?: string }> }) => {
            store.clearPayments();
            payload.payments.forEach((p) => store.addPayment(p.method as any, p.amount, { paymentAccountId: p.paymentAccountId, paymentAccountLabel: p.paymentAccountLabel }));
            setIsPaymentMenuOpen(false);
            setShowPaymentModal(false);
        },
        [store],
    );

    // ── Build checkout payload ─────────────────────────────────────────────────
    const buildCheckoutPayload = useCallback(
        (
            checkoutPayments?: Array<{ method: string; amount: number; note?: string; paymentAccountId?: string; paymentAccountLabel?: string }>,
            overrideNote?: string,
        ): CreateOrderPayload | null => {
            if (!activeTab) return null;
            return {
                customerName: activeTab.customerName,
                customerId: activeTab.customerId === 'GUEST' ? undefined : activeTab.customerId,
                branchId: activeTab.branchId,
                items: activeTab.cart.map((ci) => ({
                    id: ci.orderItemId,
                    productId: ci.productId,
                    productVariantId: ci.productVariantId,
                    sku: ci.sku,
                    serviceId: ci.serviceId && ci.serviceId !== 'EXTERNAL' ? ci.serviceId : undefined,
                    serviceVariantId: ci.serviceVariantId,
                    petId: ci.petId,
                    description: ci.description,
                    quantity: ci.quantity,
                    unitPrice: ci.unitPrice,
                    discountItem: ci.discountItem,
                    vatRate: ci.vatRate,
                    type: ci.type,
                    groomingDetails: ci.groomingDetails ? {
                        petId: ci.groomingDetails.petId,
                        performerId: ci.groomingDetails.performerId,
                        startTime: ci.groomingDetails.startTime,
                        notes: ci.groomingDetails.notes,
                        packageCode: ci.groomingDetails.packageCode,
                        weightAtBooking: ci.groomingDetails.weightAtBooking,
                        weightBandId: ci.groomingDetails.weightBandId,
                        weightBandLabel: ci.groomingDetails.weightBandLabel,
                        pricingPrice: ci.groomingDetails.pricingPrice,
                        pricingSnapshot: ci.groomingDetails.pricingSnapshot,
                    } : undefined,
                    hotelDetails: ci.hotelDetails ? {
                        petId: ci.hotelDetails.petId,
                        checkInDate: ci.hotelDetails.checkIn,
                        checkOutDate: ci.hotelDetails.checkOut,
                        branchId: activeTab.branchId,
                        lineType: ci.hotelDetails.lineType,
                        bookingGroupKey: ci.hotelDetails.bookingGroupKey,
                        chargeLineIndex: ci.hotelDetails.chargeLineIndex,
                        chargeLineLabel: ci.hotelDetails.chargeLineLabel,
                        chargeDayType: ci.hotelDetails.chargeDayType,
                        chargeQuantityDays: ci.hotelDetails.chargeQuantityDays,
                        chargeUnitPrice: ci.hotelDetails.chargeUnitPrice,
                        chargeSubtotal: ci.hotelDetails.chargeSubtotal,
                        chargeWeightBandId: ci.hotelDetails.chargeWeightBandId ?? undefined,
                        chargeWeightBandLabel: ci.hotelDetails.chargeWeightBandLabel ?? undefined,
                    } : undefined,
                    isTemp: (ci as any).isTemp || undefined,
                    tempLabel: (ci as any).tempLabel || undefined,
                })),
                payments: !activeTab.linkedOrderId && checkoutPayments ? checkoutPayments : undefined,
                discount: activeTab.discountTotal,
                shippingFee: activeTab.shippingFee,
                notes: overrideNote || activeTab.notes,
            };
        },
        [activeTab],
    );

    // ── Generate QR payment ────────────────────────────────────────────────────
    const handleGenerateQrPayment = useCallback(
        async (overrideNote?: string) => {
            const hasQr =
                currentSinglePaymentMethod?.qrEnabled ||
                tabPayments.some((p) => {
                    const m = visiblePaymentMethods.find((vm) => vm.id === p.paymentAccountId) ?? paymentMethods.find((vm) => vm.id === p.paymentAccountId);
                    return m?.type === 'BANK' && (m as any)?.qrEnabled;
                });

            if (!hasQr) { toast.error('Tài khoản BANK này chưa bật VietQR.'); return; }
            if (!Number.isInteger(cartTotal)) { toast.error('Tổng tiền QR phải là số nguyên VND. Hãy bật làm tròn POS trước khi tạo QR.'); return; }

            const payload = buildCheckoutPayload(undefined, overrideNote);
            if (!payload) return;

            setIsQrIntentPending(true);
            try {
                const orderResult = activeTab!.linkedOrderId
                    ? await orderApi.update(activeTab!.linkedOrderId, payload)
                    : await createOrder.mutateAsync(payload);
                const orderId = activeTab!.linkedOrderId ?? orderResult?.id;
                if (!orderId) throw new Error('Không tạo được đơn hàng để sinh QR');

                store.attachLinkedOrder({
                    orderId,
                    orderNumber: orderResult?.orderNumber || activeTab!.linkedOrderNumber || orderId,
                    paymentStatus: orderResult?.paymentStatus || activeTab!.linkedPaymentStatus || 'UNPAID',
                    amountPaid: orderResult?.paidAmount ?? orderResult?.amountPaid ?? activeTab!.linkedAmountPaid ?? 0,
                    branchId: orderResult?.branchId || activeTab!.branchId,
                });

                const qrMethodId = currentSinglePaymentMethod?.qrEnabled
                    ? currentSinglePaymentMethod.id
                    : (() => {
                        const bankPayment = tabPayments.find((p) => {
                            const m = visiblePaymentMethods.find((vm) => vm.id === p.paymentAccountId) ?? paymentMethods.find((vm) => vm.id === p.paymentAccountId);
                            return m?.type === 'BANK' && (m as any)?.qrEnabled;
                        });
                        return bankPayment?.paymentAccountId;
                    })();
                if (!qrMethodId) throw new Error('Không tìm thấy tài khoản BANK QR');

                const bankPaymentAmount = currentSinglePaymentMethod?.qrEnabled
                    ? cartTotal
                    : (() => {
                        const bankEntry = tabPayments.find((p) => {
                            const m = visiblePaymentMethods.find((vm) => vm.id === p.paymentAccountId) ?? paymentMethods.find((vm) => vm.id === p.paymentAccountId);
                            return m?.type === 'BANK' && (m as any)?.qrEnabled;
                        });
                        return Number(bankEntry?.amount) || cartTotal;
                    })();

                const intent = await orderApi.createPaymentIntent(orderId, { paymentMethodId: qrMethodId, amount: bankPaymentAmount });
                handledQrPaidCodeRef.current = null;
                setActiveQrIntent(intent);
                setShowQrPaymentModal(true);
                setCustomerMoneyInput('');
                toast.success(activeTab!.linkedOrderId ? 'Đã làm mới QR chuyển khoản' : 'Đã tạo QR chuyển khoản');
            } catch (error: any) {
                toast.error(error?.response?.data?.message || error?.message || 'Không thể tạo QR chuyển khoản');
            } finally {
                setIsQrIntentPending(false);
            }
        },
        [activeTab, buildCheckoutPayload, cartTotal, createOrder, currentSinglePaymentMethod, paymentMethods, store, tabPayments, visiblePaymentMethods],
    );

    // ── Cash checkout ──────────────────────────────────────────────────────────
    const handleCheckout = useCallback(
        async (paymentMethod: string, overrideNote?: string) => {
            if (!activeTab || activeTab.cart.length === 0) return;

            const effectivePayments: PaymentEntry[] =
                paymentMethod === 'UNPAID'
                    ? []
                    : activeTab.payments.length > 0
                        ? activeTab.payments.map((p, i) => ({
                            ...p,
                            amount: activeTab.payments.length === 1 && i === 0 ? cartTotal : p.amount,
                        }))
                        : preferredPaymentMethod
                            ? [{ method: preferredPaymentMethod.type, amount: cartTotal, paymentAccountId: preferredPaymentMethod.id, paymentAccountLabel: preferredPaymentMethod.name }]
                            : [];

            if (paymentMethod !== 'UNPAID' && effectivePayments.length === 0) { toast.error('Chưa có phương thức thanh toán được chọn.'); return; }
            if (paymentMethod !== 'UNPAID' && effectivePayments.some((p) => !p.paymentAccountId)) { toast.error('Chọn tài khoản nhận tiền trước khi thanh toán.'); return; }

            // Stock check
            const oversoldItems = activeTab.cart
                .filter((item) => !(item as any).isTemp)
                .map((item) => ({ item, ...resolveCartItemStockState(item, activeTab.branchId) }))
                .filter((e) => e.isOverSellableQty);
            if (oversoldItems.length > 0) {
                const first = oversoldItems[0];
                toast.error(`Sản phẩm ${first.item.description} đang vượt tồn khả dụng. Bán được ${first.sellableQty ?? 0}, đang chọn ${first.item.quantity}.`);
                return;
            }

            // QR redirect
            if (isQrBankPayment) { await handleGenerateQrPayment(overrideNote); return; }
            const multiQrBank = paymentMethod !== 'UNPAID' && effectivePayments.length > 1
                ? effectivePayments.find((p) => {
                    const m = visiblePaymentMethods.find((vm) => vm.id === p.paymentAccountId) ?? paymentMethods.find((vm) => vm.id === p.paymentAccountId);
                    return m?.type === 'BANK' && (m as any)?.qrEnabled;
                })
                : null;
            if (multiQrBank) { await handleGenerateQrPayment(overrideNote); return; }

            const checkoutPayments = paymentMethod === 'UNPAID'
                ? undefined
                : effectivePayments.map((p) => ({ method: p.method, amount: Number(p.amount) || 0, note: p.note, paymentAccountId: p.paymentAccountId, paymentAccountLabel: p.paymentAccountLabel }));
            const checkoutPaymentTotal = checkoutPayments?.reduce((sum, p) => sum + p.amount, 0) ?? 0;
            const payload = buildCheckoutPayload(checkoutPayments, overrideNote);
            if (!payload) return;

            let orderResult: any;
            if (activeTab.linkedOrderId) {
                orderResult = await orderApi.update(activeTab.linkedOrderId, payload);
                const outstanding = Math.max(0, (orderResult?.total ?? cartTotal) - (orderResult?.paidAmount ?? orderResult?.amountPaid ?? 0));
                if (paymentMethod !== 'UNPAID') {
                    if (hasServiceItems) {
                        if (checkoutPaymentTotal > 0) orderResult = await orderApi.pay(activeTab.linkedOrderId, { payments: checkoutPayments ?? [] });
                    } else if (checkoutPaymentTotal < outstanding) {
                        orderResult = await orderApi.pay(activeTab.linkedOrderId, { payments: checkoutPayments ?? [] });
                    } else if (checkoutPaymentTotal > outstanding) {
                        const overpaid = checkoutPaymentTotal - outstanding;
                        const shouldRefund = window.confirm(`Đơn đang dư ${money(overpaid)} đ. Nhấn OK để hoàn tiền ngay, hoặc Cancel để giữ lại công nợ âm cho khách.`);
                        orderResult = await orderApi.complete(activeTab.linkedOrderId, shouldRefund
                            ? { payments: checkoutPayments ?? [], overpaymentAction: 'REFUND', refundMethod: checkoutPayments?.[0]?.method ?? paymentMethod, refundPaymentAccountId: checkoutPayments?.[0]?.paymentAccountId, refundPaymentAccountLabel: checkoutPayments?.[0]?.paymentAccountLabel }
                            : { payments: checkoutPayments ?? [], overpaymentAction: 'KEEP_CREDIT' });
                    } else {
                        orderResult = await orderApi.complete(activeTab.linkedOrderId, outstanding > 0 ? { payments: checkoutPayments ?? [] } : {});
                    }
                }
            } else {
                orderResult = await createOrder.mutateAsync(payload);
            }

            store.setReceiptData({
                ...payload,
                id: orderResult?.id,
                code: orderResult?.orderNumber || `ORD-${Math.floor(Math.random() * 10000)}`,
                total: orderResult?.total ?? cartTotal,
                paidAmount: orderResult?.paidAmount ?? orderResult?.amountPaid ?? (payload.payments?.reduce((s: number, p: any) => s + p.amount, 0) ?? 0),
            });
            setCustomerMoneyInput('');
            store.resetActiveTab();
            setShowReceiptModal(true);
        },
        [activeTab, buildCheckoutPayload, cartTotal, createOrder, handleGenerateQrPayment, hasServiceItems, isQrBankPayment, paymentMethods, preferredPaymentMethod, store, visiblePaymentMethods],
    );

    // ── Service → open new tab flow ────────────────────────────────────────────
    const handleCreateServiceFlow = useCallback(async () => {
        if (!activeTab || activeTab.cart.length === 0) return;
        const newTab = window.open('about:blank', '_blank');
        if (!newTab) { toast.error('Trình duyệt đã chặn cửa sổ mới. Vui lòng cho phép popup.'); return; }
        const payload = buildCheckoutPayload(undefined, undefined);
        if (!payload) { newTab.close(); return; }
        try {
            let orderResult: any;
            if (activeTab.linkedOrderId) {
                orderResult = await orderApi.update(activeTab.linkedOrderId, payload);
            } else {
                orderResult = await createOrder.mutateAsync(payload);
            }
            if (orderResult?.id) {
                store.setReceiptData({ ...payload, id: orderResult.id, code: orderResult.orderNumber || `ORD-${Math.floor(Math.random() * 10000)}`, total: orderResult.total ?? cartTotal, paidAmount: orderResult.paidAmount ?? orderResult.amountPaid ?? 0 });
                store.closeTab(activeTab.id);
                newTab.location.href = `/orders/${orderResult.id}`;
            } else {
                newTab.close();
                toast.error('Có lỗi khi tạo đơn');
            }
        } catch (e: any) {
            newTab.close();
            toast.error(e?.response?.data?.message || e?.message || 'Có lỗi khi tạo đơn');
        }
    }, [activeTab, buildCheckoutPayload, cartTotal, createOrder, store]);

    return {
        // modal state
        showPaymentModal, setShowPaymentModal,
        showQrPaymentModal, setShowQrPaymentModal,
        showBookingModal, setShowBookingModal,
        showReceiptModal, setShowReceiptModal,
        // payment input
        customerMoneyInput, setCustomerMoneyInput,
        isPaymentMenuOpen, setIsPaymentMenuOpen,
        paymentMenuRef,
        // QR
        activeQrIntent, isQrIntentPending,
        // derived
        paymentMethods, visiblePaymentMethods,
        allowMultiPayment,
        tabPayments, isMultiPaymentSummary,
        currentSinglePaymentMethod, currentSinglePaymentType, currentSinglePaymentAmount,
        isQrBankPayment,
        guestMoney, returnMoney, multiPaymentTotal,
        hasServiceItems,
        quickCashSuggestions,
        preferredPaymentMethod,
        // handlers
        handleSelectSinglePaymentMethod,
        handleMultiPaymentConfirm,
        handleGenerateQrPayment,
        handleCheckout,
        handleCreateServiceFlow,
    };
}
