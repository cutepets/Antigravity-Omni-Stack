'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import type { PaymentEntry } from '@petshop/shared';
import type { CreateOrderPayload, OrderPaymentIntent } from '@/lib/api/order.api';
import { orderApi } from '@/lib/api/order.api';
import { settingsApi } from '@/lib/api/settings.api';
import { filterVisiblePaymentMethods } from '@/lib/payment-methods';
import {
  money,
  parseMoneyInputValue,
  buildQuickCashSuggestions,
} from '@/app/(dashboard)/_shared/payment/payment.utils';
import { createOrderQrPaymentIntent } from '@/app/(dashboard)/_shared/payment/payment-intent.utils';
import { usePaymentIntentSession } from '@/app/(dashboard)/_shared/payment/use-payment-intent-session';
import { resolveCartItemStockState } from '@/app/(dashboard)/_shared/cart/stock.utils';
import { usePosStore, useActiveTab, useCartTotal } from '@/stores/pos.store';
import { useCreateOrder } from './use-pos-mutations';

export function usePosPayment() {
  const queryClient = useQueryClient();
  const store = usePosStore();
  const activeTab = useActiveTab();
  const cartTotal = useCartTotal();
  const createOrder = useCreateOrder();

  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [customerMoneyInput, setCustomerMoneyInput] = useState('');
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);
  const [isQrIntentPending, setIsQrIntentPending] = useState(false);

  const paymentMenuRef = useRef<HTMLDivElement | null>(null);
  const autoCashSeedRef = useRef<number | null>(null);
  const handleQrPaid = useCallback(
    (intent: OrderPaymentIntent) => {
      toast.success('ÄÃ£ nháº­n thÃ´ng bÃ¡o chuyá»ƒn khoáº£n thÃ nh cÃ´ng');

      if (intent.orderId) {
        void queryClient.invalidateQueries({ queryKey: ['order', intent.orderId] });
        void queryClient.invalidateQueries({
          queryKey: ['order-payment-intents', intent.orderId],
        });
      }

      void queryClient.invalidateQueries({ queryKey: ['orders'] });

      if (intent.order) {
        store.attachLinkedOrder({
          orderId: intent.order.id,
          orderNumber: intent.order.orderNumber,
          paymentStatus: 'PAID',
          amountPaid: intent.order.paidAmount ?? intent.amount,
          branchId: activeTab?.branchId,
        });
      }
    },
    [activeTab?.branchId, queryClient, store],
  );

  const {
    activeIntent: activeQrIntent,
    setActiveIntent: setActiveQrIntent,
    displayedIntent: displayedQrIntent,
    isModalOpen: showQrPaymentModal,
    setIsModalOpen: setShowQrPaymentModal,
    openIntent: openQrIntent,
    clearIntent: clearQrIntent,
    stream: qrIntentStream,
  } = usePaymentIntentSession({ onPaid: handleQrPaid });

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

  const visiblePaymentMethods = useMemo(
    () =>
      filterVisiblePaymentMethods(paymentMethods, {
        branchId: activeTab?.branchId,
        amount: cartTotal,
      }),
    [activeTab?.branchId, cartTotal, paymentMethods],
  );

  const preferredPaymentMethod = useMemo(() => {
    const selectedPaymentAccountId = activeTab?.payments?.[0]?.paymentAccountId;
    if (selectedPaymentAccountId) {
      return (
        visiblePaymentMethods.find((method) => method.id === selectedPaymentAccountId) ??
        paymentMethods.find((method) => method.id === selectedPaymentAccountId) ??
        null
      );
    }

    return (
      visiblePaymentMethods.find((method) => method.id === store.defaultPayment) ??
      visiblePaymentMethods.find((method) => method.isDefault) ??
      visiblePaymentMethods[0] ??
      null
    );
  }, [activeTab?.payments, paymentMethods, store.defaultPayment, visiblePaymentMethods]);

  const allowMultiPayment = Boolean(paymentOptions?.allowMultiPayment);
  const tabPayments = activeTab?.payments ?? [];
  const isMultiPaymentSummary = tabPayments.length > 1;
  const selectedSinglePayment = tabPayments.length === 1 ? tabPayments[0] : null;
  const currentSinglePaymentMethod =
    selectedSinglePayment?.paymentAccountId
      ? visiblePaymentMethods.find((method) => method.id === selectedSinglePayment.paymentAccountId) ??
        paymentMethods.find((method) => method.id === selectedSinglePayment.paymentAccountId) ??
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
  const multiPaymentTotal = tabPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const hasServiceItems =
    activeTab?.cart.some(
      (item) =>
        item.type === 'service' ||
        item.type === 'hotel' ||
        item.type === 'grooming' ||
        item.groomingDetails ||
        item.hotelDetails,
    ) || false;
  const quickCashSuggestions = useMemo(() => buildQuickCashSuggestions(cartTotal), [cartTotal]);

  useEffect(() => {
    if (!activeTab || isMultiPaymentSummary || currentSinglePaymentType !== 'CASH') return;

    const parsedCurrent = parseMoneyInputValue(customerMoneyInput);
    const previousSeed = autoCashSeedRef.current;
    const shouldSeed = !customerMoneyInput || (previousSeed !== null && parsedCurrent === previousSeed);

    if (shouldSeed) {
      setCustomerMoneyInput(cartTotal > 0 ? money(cartTotal) : '');
    }

    autoCashSeedRef.current = cartTotal;
  }, [activeTab, cartTotal, currentSinglePaymentType, customerMoneyInput, isMultiPaymentSummary]);

  useEffect(() => {
    if (!isPaymentMenuOpen) return;

    const handleOutsideMenu = (event: MouseEvent) => {
      if (paymentMenuRef.current && !paymentMenuRef.current.contains(event.target as Node)) {
        setIsPaymentMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handleOutsideMenu);
    return () => document.removeEventListener('mousedown', handleOutsideMenu);
  }, [isPaymentMenuOpen]);


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
    [cartTotal, paymentMethods, store],
  );

  const handleMultiPaymentConfirm = useCallback(
    (payload: {
      payments: Array<{
        method: string;
        amount: number;
        paymentAccountId?: string;
        paymentAccountLabel?: string;
      }>;
    }) => {
      store.clearPayments();
      payload.payments.forEach((payment) => {
        store.addPayment(payment.method as any, payment.amount, {
          paymentAccountId: payment.paymentAccountId,
          paymentAccountLabel: payment.paymentAccountLabel,
        });
      });
      setIsPaymentMenuOpen(false);
      setShowPaymentModal(false);
    },
    [store],
  );

  const buildCheckoutPayload = useCallback(
    (
      checkoutPayments?: Array<{
        method: string;
        amount: number;
        note?: string;
        paymentAccountId?: string;
        paymentAccountLabel?: string;
      }>,
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
          groomingDetails: ci.groomingDetails
            ? {
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
              }
            : undefined,
          hotelDetails: ci.hotelDetails
            ? {
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
              }
            : undefined,
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

  const handleGenerateQrPayment = useCallback(
    async (overrideNote?: string) => {
      if (!activeTab || !currentSinglePaymentMethod?.id) return;
      if (isMultiPaymentSummary) {
        toast.error('QR POS hiện chỉ áp dụng cho 1 phương thức BANK trên mỗi đơn.');
        return;
      }
      if (!currentSinglePaymentMethod.qrEnabled) {
        toast.error('Tài khoản BANK này chưa bật VietQR.');
        return;
      }
      if (!Number.isInteger(cartTotal)) {
        toast.error('Tổng tiền QR phải là số nguyên VND. Hãy bật làm tròn POS trước khi tạo QR.');
        return;
      }

      const payload = buildCheckoutPayload(undefined, overrideNote);
      if (!payload) return;

      setIsQrIntentPending(true);
      try {
        const orderResult = activeTab.linkedOrderId
          ? await orderApi.update(activeTab.linkedOrderId, payload)
          : await createOrder.mutateAsync(payload);
        const orderId = activeTab.linkedOrderId ?? orderResult?.id;

        if (!orderId) {
          throw new Error('Không tạo được đơn hàng để sinh QR');
        }

        store.attachLinkedOrder({
          orderId,
          orderNumber: orderResult?.orderNumber || activeTab.linkedOrderNumber || orderId,
          paymentStatus: orderResult?.paymentStatus || activeTab.linkedPaymentStatus || 'UNPAID',
          amountPaid: orderResult?.paidAmount ?? orderResult?.amountPaid ?? activeTab.linkedAmountPaid ?? 0,
          branchId: orderResult?.branchId || activeTab.branchId,
        });

        const intent = await createOrderQrPaymentIntent({
          orderId,
          paymentMethodId: currentSinglePaymentMethod.id,
        });

        openQrIntent(intent);
        setCustomerMoneyInput('');
        toast.success(activeTab.linkedOrderId ? 'Đã làm mới QR chuyển khoản' : 'Đã tạo QR chuyển khoản');
      } catch (error: any) {
        toast.error(error?.response?.data?.message || error?.message || 'Không thể tạo QR chuyển khoản');
      } finally {
        setIsQrIntentPending(false);
      }
    },
    [
      activeTab,
      buildCheckoutPayload,
      cartTotal,
      createOrder,
      currentSinglePaymentMethod,
      isMultiPaymentSummary,
      openQrIntent,
      store,
    ],
  );

  const handleCreateServiceFlow = useCallback(async () => {
    if (!activeTab || activeTab.cart.length === 0) return;
    const newTab = window.open('about:blank', '_blank');
    if (!newTab) {
      toast.error('Trình duyệt đã chặn cửa sổ mới. Vui lòng cho phép popup.');
      return;
    }

    const payload = buildCheckoutPayload(undefined, undefined);
    if (!payload) {
      newTab.close();
      return;
    }

    try {
      let orderResult: any;
      if (activeTab.linkedOrderId) {
        orderResult = await orderApi.update(activeTab.linkedOrderId, payload);
      } else {
        orderResult = await createOrder.mutateAsync(payload);
      }
      if (orderResult?.id) {
        store.setReceiptData({
          ...payload,
          id: orderResult.id,
          code: orderResult.orderNumber || `ORD-${Math.floor(Math.random() * 10000)}`,
          total: orderResult.total ?? cartTotal,
          paidAmount: orderResult.paidAmount ?? orderResult.amountPaid ?? 0,
        });
        store.closeTab(activeTab.id);
        newTab.location.href = `/orders/${orderResult.id}`;
      } else {
        newTab.close();
        toast.error('Có lỗi khi tạo đơn');
      }
    } catch (error: any) {
      newTab.close();
      toast.error(error?.response?.data?.message || error?.message || 'Có lỗi khi tạo đơn');
    }
  }, [activeTab, buildCheckoutPayload, cartTotal, createOrder, store]);

  const handleCheckout = useCallback(
    async (paymentMethod: string, overrideNote?: string) => {
      if (!activeTab || activeTab.cart.length === 0) return;
      const effectivePayments =
        paymentMethod === 'UNPAID'
          ? []
          : activeTab.payments.length > 0
            ? activeTab.payments.map((payment, index) => ({
                ...payment,
                amount: activeTab.payments.length === 1 && index === 0 ? cartTotal : payment.amount,
              }))
            : preferredPaymentMethod
              ? ([{
                  method: preferredPaymentMethod.type,
                  amount: cartTotal,
                  paymentAccountId: preferredPaymentMethod.id,
                  paymentAccountLabel: preferredPaymentMethod.name,
                }] as PaymentEntry[])
              : [];

      if (paymentMethod !== 'UNPAID' && effectivePayments.length === 0) {
        toast.error('Chưa có phương thức thanh toán được chọn.');
        return;
      }

      if (paymentMethod !== 'UNPAID' && effectivePayments.some((payment) => !payment.paymentAccountId)) {
        toast.error('Chọn tài khoản nhận tiền trước khi thanh toán.');
        return;
      }

      const oversoldItems = activeTab.cart
        .map((item) => ({
          item,
          ...resolveCartItemStockState(item, activeTab.branchId),
        }))
        .filter((entry) => entry.isOverSellableQty);

      if (oversoldItems.length > 0) {
        const firstOversold = oversoldItems[0];
        const sellableQty = firstOversold.sellableQty ?? 0;
        toast.error(
          `Sản phẩm ${firstOversold.item.description} đang vượt tồn khả dụng. Bán được ${sellableQty}, đang chọn ${firstOversold.item.quantity}.`,
        );
        return;
      }

      if (isQrBankPayment) {
        await handleGenerateQrPayment(overrideNote);
        return;
      }

      const checkoutPayments =
        paymentMethod === 'UNPAID'
          ? undefined
          : effectivePayments.map((payment) => ({
              method: payment.method,
              amount: Number(payment.amount) || 0,
              note: payment.note,
              paymentAccountId: payment.paymentAccountId,
              paymentAccountLabel: payment.paymentAccountLabel,
            }));
      const checkoutPaymentTotal = checkoutPayments?.reduce((sum, payment) => sum + payment.amount, 0) ?? 0;
      const payload = buildCheckoutPayload(checkoutPayments, overrideNote);
      if (!payload) return;

      let orderResult: any;

      if (activeTab.linkedOrderId) {
        orderResult = await orderApi.update(activeTab.linkedOrderId, payload);
        const outstanding = Math.max(
          0,
          (orderResult?.total ?? cartTotal) - (orderResult?.paidAmount ?? orderResult?.amountPaid ?? 0),
        );

        if (paymentMethod !== 'UNPAID') {
          if (hasServiceItems) {
            if (checkoutPaymentTotal > 0) {
              orderResult = await orderApi.pay(activeTab.linkedOrderId, {
                payments: checkoutPayments ?? [],
              });
            }
          } else {
            if (checkoutPaymentTotal < outstanding) {
              orderResult = await orderApi.pay(activeTab.linkedOrderId, {
                payments: checkoutPayments ?? [],
              });
            } else if (checkoutPaymentTotal > outstanding) {
              const overpaid = checkoutPaymentTotal - outstanding;
              const shouldRefund = window.confirm(
                `Đơn đang dư ${money(overpaid)} đ. Nhấn OK để hoàn tiền ngay, hoặc Cancel để giữ lại công nợ âm cho khách.`,
              );
              orderResult = await orderApi.complete(
                activeTab.linkedOrderId,
                shouldRefund
                  ? {
                      payments: checkoutPayments ?? [],
                      overpaymentAction: 'REFUND',
                      refundMethod: checkoutPayments?.[0]?.method ?? paymentMethod,
                      refundPaymentAccountId: checkoutPayments?.[0]?.paymentAccountId,
                      refundPaymentAccountLabel: checkoutPayments?.[0]?.paymentAccountLabel,
                    }
                  : { payments: checkoutPayments ?? [], overpaymentAction: 'KEEP_CREDIT' },
              );
            } else {
              orderResult = await orderApi.complete(
                activeTab.linkedOrderId,
                outstanding > 0
                  ? {
                      payments: checkoutPayments ?? [],
                    }
                  : {},
              );
            }
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
        paidAmount:
          orderResult?.paidAmount ??
          orderResult?.amountPaid ??
          payload.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) ??
          0,
      });
      setCustomerMoneyInput('');

      if (orderResult?.id) {
        setShowPaymentModal(false);
        setShowBookingModal(false);
        setShowQrPaymentModal(false);
        clearQrIntent();
        store.resetActiveTab();
      }
    },
    [
      activeTab,
      buildCheckoutPayload,
      cartTotal,
      createOrder,
      handleGenerateQrPayment,
      hasServiceItems,
      isQrBankPayment,
      preferredPaymentMethod,
      store,
      clearQrIntent,
    ],
  );

  return {
    showPaymentModal,
    setShowPaymentModal,
    showQrPaymentModal,
    setShowQrPaymentModal,
    showBookingModal,
    setShowBookingModal,
    customerMoneyInput,
    setCustomerMoneyInput,
    isPaymentMenuOpen,
    setIsPaymentMenuOpen,
    paymentMenuRef,
    activeQrIntent,
    setActiveQrIntent,
    displayedQrIntent,
    clearQrIntent,
    isQrIntentPending,
    qrIntentStream,
    paymentMethods,
    visiblePaymentMethods,
    allowMultiPayment,
    tabPayments,
    isMultiPaymentSummary,
    currentSinglePaymentMethod,
    currentSinglePaymentType,
    currentSinglePaymentAmount,
    isQrBankPayment,
    guestMoney,
    returnMoney,
    multiPaymentTotal,
    hasServiceItems,
    quickCashSuggestions,
    preferredPaymentMethod,
    handleSelectSinglePaymentMethod,
    handleMultiPaymentConfirm,
    handleGenerateQrPayment,
    handleCheckout,
    handleCreateServiceFlow,
  };
}
