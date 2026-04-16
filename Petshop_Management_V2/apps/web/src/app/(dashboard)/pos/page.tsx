'use client';

import { useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePosStore, useActiveTab, useCartSubtotal, useCartTotal, useCartItemCount } from '@/stores/pos.store';
import { useAuthStore } from '@/stores/auth.store';
import { useCreateOrder } from './_hooks/use-pos-mutations';
import { useBranches } from './_hooks/use-pos-queries';
import type { CreateOrderPayload, OrderPaymentIntent } from '@/lib/api/order.api';
import type { CartItem, PaymentEntry } from '@petshop/shared';
import { settingsApi } from '@/lib/api/settings.api';
import { filterVisiblePaymentMethods, getPaymentMethodColorClasses } from '@/lib/payment-methods';
import { HotelCheckoutModal } from './components/HotelCheckoutModal';
import { PosCustomerV1 } from './components/PosCustomerV1';
import { PosSettingsPanel } from './components/PosSettingsPanel';
import { PosPaymentModal } from './components/PosPaymentModal';
import { PosQrPaymentModal } from './components/PosQrPaymentModal';
import { PosShiftClosingModal } from './components/PosShiftClosingModal';
import { PosOrderBookingModal } from './components/PosOrderBookingModal';

import { PosProductSearch } from './components/PosProductSearch';
import { PosNotifications } from './components/PosNotifications';
import { PosBranchSelect } from './components/PosBranchSelect';
import { Menu, X, Plus, Minus, Trash2, Home, NotebookText, Info, FileText, Settings, UserCircle2, Bell, LogOut, Scissors, Package, ShoppingCart, Maximize, Store, QrCode, Zap, EyeOff, Eye, ListChecks, ChevronDown, Check } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { orderApi } from '@/lib/api/order.api';
import { customToast as toast } from '@/components/ui/toast-with-copy';
import { usePaymentIntentStream } from '@/hooks/use-payment-intent-stream';
import { shiftApi } from '@/lib/api/shift.api';

// â”€â”€â”€ Format helpers â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const money = (n: number) => new Intl.NumberFormat('vi-VN').format(n);
const parseMoneyInputValue = (value: string) => {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
};

function buildQuickCashSuggestions(total: number) {
  if (!Number.isFinite(total) || total <= 0) return [];

  const steps = [2000, 5000, 10000, 20000, 50000, 100000, 200000, 500000];
  const candidates = steps
    .map((step) => Math.ceil(total / step) * step)
    .filter((value) => value > total);

  return [...new Set(candidates)].sort((left, right) => left - right).slice(0, 6);
}
const moneyRaw = money; // alias – same formatter

function parseCartQuantityInput(value: string) {
  const normalized = value.replace(/[^\d.,]/g, '').replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function getCartQuantityStep(item: { type?: string }) {
  return item.type === 'hotel' ? 0.5 : 1;
}

function getCartItemWeightBandLabel(item: CartItem) {
  return item.weightBandLabel ?? item.groomingDetails?.weightBandLabel ?? item.hotelDetails?.chargeWeightBandLabel ?? null;
}

function normalizeServiceText(value?: string) {
  return value
    ?.normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase() ?? '';
}

function isHotelService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`);
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase();
  return service?.pricingKind === 'HOTEL' || serviceType === 'HOTEL' || service?.suggestionKind === 'HOTEL' || text.includes('hotel') || text.includes('luu chuong');
}

function isGroomingService(service: any) {
  const serviceType = String(service?.serviceType ?? service?.type ?? '').toUpperCase();
  return service?.pricingKind === 'GROOMING' || serviceType === 'GROOMING' || service?.suggestionKind === 'SPA' || service?.packageCode !== undefined;
}

function isCatalogService(item: any) {
  return (
    isHotelService(item) ||
    isGroomingService(item) ||
    item.serviceId !== undefined ||
    item.serviceVariantId !== undefined ||
    item.pricingKind !== undefined ||
    item.suggestionKind !== undefined ||
    (item.productId === undefined && item.productVariantId === undefined && item.productName === undefined && item.price !== undefined)
  );
}

function getOrderServiceId(service: any) {
  if (service?.serviceId) return service.serviceId;
  return service?.entryType?.startsWith('pricing-') ? undefined : service?.id;
}

function inferSpaPackageCodeFromService(service: any) {
  const text = normalizeServiceText(`${service?.name ?? ''} ${service?.sku ?? ''}`);
  const hasBath = text.includes('tam');
  const hasClip = text.includes('cao') || text.includes('cat');
  const hasHygiene = text.includes('ve sinh');

  if (text.includes('spa')) return 'SPA';
  if (hasBath && hasClip && hasHygiene) return 'BATH_CLIP_HYGIENE';
  if (hasBath && hasHygiene) return 'BATH_HYGIENE';
  if (hasClip) return 'CLIP';
  if (hasBath) return 'BATH';
  if (hasHygiene) return 'HYGIENE';
  return undefined;
}

function buildCartLineId(type: 'product' | 'service' | 'hotel' | 'grooming', ...parts: Array<string | number | null | undefined>) {
  return [type, ...parts.filter((part) => part !== undefined && part !== null && String(part).trim() !== '')]
    .map((part) => String(part).replace(/\s+/g, '-'))
    .join(':');
}

function buildDirectServiceCartItem(service: any, petId?: string): CartItem {
  const itemType = isHotelService(service) ? 'hotel' : 'service';
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0);

  return {
    id: buildCartLineId(itemType, service.id, petId),
    serviceId: getOrderServiceId(service),
    description: isHotelService(service)
      ? `Lưu trú${service.weightBandLabel ? ` - ${service.weightBandLabel}` : ''}`
      : service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: itemType,
    image: service.image,
    unit: itemType === 'hotel' ? 'ngày' : 'lần',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
  };
}

function buildGroomingCartItem(service: any, petId?: string): CartItem {
  const unitPrice = Number(service?.sellingPrice ?? service?.price ?? 0);
  const packageCode = service?.packageCode ?? inferSpaPackageCodeFromService(service);
  const petWeight = Number(service?.petSnapshot?.weight ?? Number.NaN);
  const pricingSnapshot =
    service?.pricingSnapshot ??
    (service?.pricingRuleId || service?.weightBandId
      ? {
        pricingRuleId: service?.pricingRuleId,
        packageCode,
        weightBandId: service?.weightBandId ?? null,
        weightBandLabel: service?.weightBandLabel ?? null,
        price: unitPrice,
      }
      : undefined);

  return {
    id: buildCartLineId('grooming', service.id, petId),
    serviceId: getOrderServiceId(service),
    description: service.name,
    sku: service.sku,
    weightBandLabel: service.weightBandLabel,
    unitPrice,
    type: 'grooming',
    image: service.image,
    unit: 'lần',
    discountItem: 0,
    vatRate: 0,
    quantity: 1,
    petId,
    groomingDetails: petId
      ? {
        petId,
        packageCode,
        serviceItems: service?.name,
        weightAtBooking: Number.isFinite(petWeight) ? petWeight : undefined,
        weightBandId: service?.weightBandId,
        weightBandLabel: service?.weightBandLabel,
        pricingPrice: unitPrice,
        pricingSnapshot,
      }
      : undefined,
  };
}

function getSellableQuantity(stockSource: any, branchId?: string) {
  if (!stockSource) return null;

  if (branchId && Array.isArray(stockSource.branchStocks) && stockSource.branchStocks.length > 0) {
    const branchStock = stockSource.branchStocks.find(
      (entry: any) => entry.branchId === branchId || entry.branch?.id === branchId,
    );

    if (!branchStock) return 0;

    const available =
      branchStock.availableStock ?? ((branchStock.stock ?? 0) - (branchStock.reservedStock ?? branchStock.reserved ?? 0));

    return Math.max(0, Number(available) || 0);
  }

  if (stockSource.availableStock !== undefined && stockSource.availableStock !== null) {
    return Math.max(0, Number(stockSource.availableStock) || 0);
  }

  if (stockSource.stock !== undefined && stockSource.stock !== null) {
    return Math.max(0, Number(stockSource.stock || 0) - Number(stockSource.trading ?? stockSource.reserved ?? 0));
  }

  return null;
}

function resolveCartItemStockState(item: any, branchId?: string) {
  const itemVariants = item.variants || [];
  const isConversion = (variant: any) => {
    if (!variant?.conversions) return false;
    try {
      const parsed = JSON.parse(variant.conversions);
      return !!(parsed?.rate || parsed?.conversionRate || parsed?.mainQty);
    } catch {
      return false;
    }
  };

  const trueVariants = itemVariants.filter((variant: any) => !isConversion(variant));
  const allConversionVariants = itemVariants.filter(isConversion);
  const currentVariantObj = itemVariants.find((variant: any) => variant.id === item.productVariantId);
  const isCurrentConversion = currentVariantObj ? isConversion(currentVariantObj) : false;

  let currentTrueVariant: any = null;
  if (currentVariantObj) {
    if (isCurrentConversion) {
      currentTrueVariant = trueVariants.find((variant: any) => currentVariantObj.name.startsWith(variant.name + ' - '));
    } else {
      currentTrueVariant = currentVariantObj;
    }
  }

  const conversionVariants = currentTrueVariant
    ? allConversionVariants.filter((variant: any) => variant.name.startsWith(currentTrueVariant.name + ' - '))
    : allConversionVariants.filter((variant: any) => !trueVariants.some((trueVariant: any) => variant.name.startsWith(trueVariant.name + ' - ')));
  const stockSource = currentTrueVariant ?? currentVariantObj ?? item;
  const sellableQty = getSellableQuantity(stockSource, branchId);

  return {
    itemVariants,
    trueVariants,
    allConversionVariants,
    currentVariantObj,
    isCurrentConversion,
    currentTrueVariant,
    conversionVariants,
    stockSource,
    sellableQty,
    isOverSellableQty: sellableQty !== null && (item.quantity ?? 1) > sellableQty,
  };
}

function PosPageContent() {
  const router = useRouter()
  const queryClient = useQueryClient();
  const [showHotelCheckout, setShowHotelCheckout] = useState(false);
  const [selectedHotelPetId, setSelectedHotelPetId] = useState<string | undefined>();
  const [noteEditingId, setNoteEditingId] = useState<string | null>(null);
  const [discountEditingId, setDiscountEditingId] = useState<string | null>(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [showQrPaymentModal, setShowQrPaymentModal] = useState(false);
  const [showShiftClosingModal, setShowShiftClosingModal] = useState(false);
  const [activeQrIntent, setActiveQrIntent] = useState<OrderPaymentIntent | null>(null);
  const [isQrIntentPending, setIsQrIntentPending] = useState(false);
  const [isPaymentMenuOpen, setIsPaymentMenuOpen] = useState(false);

  // Realtime input fields for customer cash
  const [customerMoneyInput, setCustomerMoneyInput] = useState<string>('');
  const [selectedRowIndex, setSelectedRowIndex] = useState<number>(-1);
  const paymentMenuRef = useRef<HTMLDivElement | null>(null);
  const autoCashSeedRef = useRef<number | null>(null);
  const handledQrPaidCodeRef = useRef<string | null>(null);

  // â”€â”€ Store â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const store = usePosStore();
  const activeTab = useActiveTab();
  const cartSubtotal = useCartSubtotal();
  const cartTotal = useCartTotal();
  const cartCount = useCartItemCount();
  const activeBranchId = useAuthStore((state) => state.activeBranchId);
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
  const shiftCurrentQuery = useQuery({
    queryKey: ['shifts', 'current', activeBranchId],
    queryFn: () => shiftApi.current(),
    enabled: Boolean(activeBranchId),
    staleTime: 15_000,
  });

  // Auto-open shift modal khi ca chưa mở hoặc đã đóng
  useEffect(() => {
    if (!shiftCurrentQuery.isFetched) return
    const shift = shiftCurrentQuery.data
    // Chưa có ca nào hoặc ca hiện tại đã chốt (CLOSED) → mở modal
    if (!shift) {
      setShowShiftClosingModal(true)
    }
  }, [shiftCurrentQuery.isFetched, shiftCurrentQuery.data])

  // â”€â”€ Mutations â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const createOrder = useCreateOrder();

  // â”€â”€ URL Search Params â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  // POS no longer resumes existing orders from URL. Editing/viewing saved orders now belongs to Orders workspace.
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

  const { data: branches = [] } = useBranches();

  // â”€â”€ Keyboard shortcuts â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    if (!activeTab || !activeBranchId) return;
    if (activeTab.linkedOrderId) return;
    if (activeTab.branchId === activeBranchId) return;
    store.setBranch(activeBranchId);
  }, [activeBranchId, activeTab, store]);

  const visiblePaymentMethods = useMemo(
    () =>
      filterVisiblePaymentMethods(paymentMethods, {
        branchId: activeTab?.branchId ?? activeBranchId,
        amount: cartTotal,
      }),
    [activeBranchId, activeTab?.branchId, cartTotal, paymentMethods],
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
  const currentSinglePaymentAmount = currentSinglePaymentType === 'CASH'
    ? parseMoneyInputValue(customerMoneyInput || money(cartTotal))
    : cartTotal;
  const isQrBankPayment =
    !isMultiPaymentSummary &&
    currentSinglePaymentMethod?.type === 'BANK' &&
    Boolean(currentSinglePaymentMethod.qrEnabled);
  const baseOrderTotal = cartSubtotal + (activeTab?.shippingFee ?? 0);
  const manualDiscountTotal = activeTab?.manualDiscountTotal ?? activeTab?.discountTotal ?? 0;
  const roundingDiscountTotal = activeTab?.roundingDiscountTotal ?? 0;
  const guestMoney = currentSinglePaymentType === 'CASH' ? currentSinglePaymentAmount : cartTotal;
  const returnMoney = currentSinglePaymentType === 'CASH' && guestMoney > cartTotal ? guestMoney - cartTotal : 0;
  const multiPaymentTotal = tabPayments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
  const hasServiceItems = activeTab?.cart.some((item) =>
    item.type === 'service' || item.type === 'hotel' || item.type === 'grooming' || item.groomingDetails || item.hotelDetails,
  ) || false;
  const quickCashSuggestions = useMemo(
    () => buildQuickCashSuggestions(cartTotal),
    [cartTotal],
  );

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

  // â”€â”€ Add to cart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleAddItem = useCallback(
    (item: any) => {
      const isHotel = isHotelService(item);
      const isGrooming = isGroomingService(item);

      if (isHotel) {
        store.addItem(buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activeTab.activePetIds?.[0]));
        toast.success('Đã thêm dịch vụ vào giỏ');
        return;
      }

      if (isGrooming) {
        store.addItem(buildGroomingCartItem(item, item.petId ?? item.petSnapshot?.id ?? activeTab.activePetIds?.[0]));
        toast.success('Đã thêm dịch vụ vào giỏ');
        return;
      }

      if (isCatalogService(item)) {
        store.addItem(buildDirectServiceCartItem(item, item.petId ?? item.petSnapshot?.id ?? activeTab.activePetIds?.[0]));
        toast.success('Đã thêm dịch vụ vào giỏ');
        return;
      }

      const productId = item.productId ?? item.id;
      const productVariantId = item.productVariantId;
      const unitPrice = item.sellingPrice ?? item.price ?? 0;

      store.addItem({
        id: buildCartLineId('product', productId, productVariantId ?? 'base'),
        productId,
        productVariantId,
        description: item.productName ?? item.name,
        sku: item.sku,
        barcode: item.barcode,
        unitPrice,
        type: 'product',
        image: item.image,
        unit: item.unit ?? 'cái',
        variants: item.variants,
        variantName: item.variantLabel,
        baseSku: item.sku,
        baseUnitPrice: unitPrice,
        stock: item.stock,
        availableStock: item.availableStock,
        trading: item.trading,
        reserved: item.reserved,
        branchStocks: item.branchStocks,
      });
    },
    [store, activeTab?.activePetIds],
  );

  // â”€â”€ Checkout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSelectSuggestedService = useCallback(
    (service: any, petId: string, petName?: string) => {
      const cart = store.tabs.find((t) => t.id === store.activeTabId)?.cart ?? [];
      const isDuplicate = cart.some(
        (item) => item.petId === petId && (
          item.serviceId === service.id ||
          (item.sku && service.sku && item.sku === service.sku) ||
          item.description === service.name ||
          (item.type === 'hotel' && service.suggestionKind === 'HOTEL') ||
          (item.type === 'grooming' && service.suggestionKind === 'SPA')
        )
      );
      if (isDuplicate) {
        toast.warning(`Dịch vụ "${service.name}" đã có trong giỏ hàng.`);
        return;
      }

      if (isHotelService(service)) {
        const item = buildDirectServiceCartItem(service, petId);
        if (petName) item.itemNotes = `Thú cưng: ${petName}`;
        store.addItem(item);
        toast.success('Đã thêm dịch vụ lưu chuồng vào giỏ');
        return;
      }

      const item = buildGroomingCartItem(service, petId);
      if (petName) item.itemNotes = `Thú cưng: ${petName}`;
      store.addItem(item);
      toast.success('Đã thêm dịch vụ vào giỏ');
    },
    [store],
  );

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

        const intent = await orderApi.createPaymentIntent(orderId, {
          paymentMethodId: currentSinglePaymentMethod.id,
        });

        handledQrPaidCodeRef.current = null;
        setActiveQrIntent(intent);
        setShowQrPaymentModal(true);
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
    } catch (e: any) {
      newTab.close();
      toast.error(e?.response?.data?.message || e?.message || 'Có lỗi khi tạo đơn');
    }
  }, [activeTab, buildCheckoutPayload, createOrder, store, cartTotal]);


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
              ? ([
                {
                  method: preferredPaymentMethod.type,
                  amount: cartTotal,
                  paymentAccountId: preferredPaymentMethod.id,
                  paymentAccountLabel: preferredPaymentMethod.name,
                },
              ] as PaymentEntry[])
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
        // Đơn đã tồn tại -> Chỉ cho phép thanh toán thêm
        orderResult = await orderApi.update(activeTab.linkedOrderId, payload);
        const outstanding = Math.max(0, (orderResult?.total ?? cartTotal) - (orderResult?.paidAmount ?? orderResult?.amountPaid ?? 0));

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
              orderResult = await orderApi.complete(activeTab.linkedOrderId, outstanding > 0 ? {
                payments: checkoutPayments ?? [],
              } : {});
            }
          }
        }
      } else {
        // Đơn tạo mới
        orderResult = await createOrder.mutateAsync(payload);
      }

      store.setReceiptData({
        ...payload,
        id: orderResult?.id,
        code: orderResult?.orderNumber || `ORD-${Math.floor(Math.random() * 10000)}`,
        total: orderResult?.total ?? cartTotal,
        paidAmount: orderResult?.paidAmount ?? orderResult?.amountPaid ?? payload.payments?.reduce((sum: number, payment: any) => sum + payment.amount, 0) ?? 0,
      });
      setCustomerMoneyInput('');

      // Redirect to order detail page
      if (orderResult?.id) {
        router.push(`/orders/${orderResult.id}`)
      }
    },
    [
      activeTab,
      buildCheckoutPayload,
      cartTotal,
      createOrder,
      handleGenerateQrPayment,
      isQrBankPayment,
      preferredPaymentMethod,
      router,
      store,
      hasServiceItems,
    ],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const activeElement = document.activeElement;
      const isInputFocused = activeElement?.tagName === 'INPUT' || activeElement?.tagName === 'TEXTAREA';

      // Cho phép F-keys ngay cả khi đang focus
      if (e.key === 'F2') {
        e.preventDefault();
        store.addTab();
        return;
      }
      if (e.key === 'F8') {
        e.preventDefault();
        document.getElementById('customer_money_input')?.focus();
        return;
      }
      if (e.key === 'F9') {
        e.preventDefault();
        if (hasServiceItems) {
          handleCreateServiceFlow();
        } else {
          const method = activeTab?.payments?.[0]?.method ?? preferredPaymentMethod?.type ?? 'CASH';
          handleCheckout(method as string);
        }
        return;
      }

      const isQuantityInput = activeElement?.id?.startsWith('quantity-input-') || activeElement?.id === 'quantity-input';
      if (isInputFocused && !isQuantityInput) return;
      if (!activeTab || activeTab.cart.length === 0) return;

      if (e.key === 'ArrowUp') {
        if (!isInputFocused) {
          e.preventDefault();
          setSelectedRowIndex((prev) => {
            const next = prev > 0 ? prev - 1 : 0;
            const rowId = `cart-row-${activeTab.cart[next].id}`;
            document.getElementById(rowId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
        }
      } else if (e.key === 'ArrowDown') {
        if (!isInputFocused) {
          e.preventDefault();
          setSelectedRowIndex((prev) => {
            const next = prev < activeTab.cart.length - 1 ? prev + 1 : activeTab.cart.length - 1;
            const rowId = `cart-row-${activeTab.cart[next].id}`;
            document.getElementById(rowId)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
            return next;
          });
        }
      } else if (e.key === 'ArrowLeft') {
        if (selectedRowIndex >= 0 && selectedRowIndex < activeTab.cart.length) {
          e.preventDefault();
          const item = activeTab.cart[selectedRowIndex];
          const step = getCartQuantityStep(item);
          store.updateQuantity(item.id, Math.max(0, (item.quantity ?? 1) - step));
        }
      } else if (e.key === 'ArrowRight') {
        if (selectedRowIndex >= 0 && selectedRowIndex < activeTab.cart.length) {
          e.preventDefault();
          const item = activeTab.cart[selectedRowIndex];
          const step = getCartQuantityStep(item);
          store.updateQuantity(item.id, (item.quantity ?? 1) + step);
        }
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, handleCheckout, preferredPaymentMethod?.type, store, hasServiceItems, handleCreateServiceFlow, selectedRowIndex]);

  if (!activeTab) return null;

  return (
    <div className="flex flex-col h-screen bg-[#f0f2f5] font-sans text-gray-800 overflow-hidden">
      {/* â• â• â•  HEADER (V1 KiotViet Style) â• â• â•  */}
      <header className="relative z-50 flex items-center justify-between px-2 lg:px-3 h-[50px] bg-[#0089A1] text-white shrink-0 gap-2">

        {/* Left: Search Bar & Tabs */}
        <div className="flex-1 lg:flex-none lg:w-2/3 flex items-end h-full">
          {/* Search + Barcode + OutOfStock toggle */}
          <div className="flex items-center gap-2 w-full lg:w-auto h-full py-1.5 pb-2">

            {/* Mobile LogOut */}
            <button
              className="lg:hidden p-1.5 hover:bg-white/20 rounded text-red-100 transition-colors shrink-0"
              title="Thoát"
              onClick={() => {
                if (window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                  window.location.href = '/';
                }
              }}
            >
              <LogOut size={20} />
            </button>

            {/* Desktop Menu */}
            <Menu size={20} className="cursor-pointer hover:opacity-80 transition-opacity hidden lg:block shrink-0" />

            <div className="flex-1 lg:w-[300px] lg:flex-none">
              <PosProductSearch onSelect={handleAddItem} />
            </div>

            <button
              className={`hidden lg:block p-1.5 hover:bg-white/20 rounded border transition-colors shrink-0 ${store.isMultiSelect ? 'border-amber-400 text-amber-400 bg-white/10' : 'border-white/20 text-white'}`}
              title={store.isMultiSelect ? "Tắt chọn nhiều" : "Bật chọn nhiều (Thêm nhanh nhiều sản phẩm liên tục)"}
              onMouseDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.preventDefault();
                store.setIsMultiSelect(!store.isMultiSelect);
              }}
            >
              <ListChecks size={18} />
            </button>

            <button
              className="p-1.5 hover:bg-white/20 rounded border border-white/20 transition-colors shrink-0"
              title={store.outOfStockHidden ? "Đang ẩn sản phẩm hết hàng" : "Đang hiện sản phẩm hết hàng"}
              onClick={() => store.setOutOfStockHidden(!store.outOfStockHidden)}
            >
              {store.outOfStockHidden ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          {/* Nav Tabs next to search bar */}
          <div className="hidden lg:flex flex-1 flex-row items-end overflow-hidden ml-3 h-full">
            <div className="flex gap-0.5 h-full items-end no-scrollbar overflow-x-auto">
              {store.tabs.map((tab) => {
                const isActive = tab.id === store.activeTabId;
                return (
                  <div
                    key={tab.id}
                    onClick={() => store.setActiveTab(tab.id)}
                    className={`
                      group flex items-center h-[36px] gap-2 px-3 rounded-t-lg cursor-pointer 
                      transition-colors min-w-[100px] max-w-[180px] border-t border-l border-r border-[#006e82]/50
                      ${isActive
                        ? 'bg-white text-gray-800 font-semibold'
                        : 'bg-white/20 text-white hover:bg-white/30 backdrop-blur-sm'}
                    `}
                  >
                    <span className="truncate flex-1 text-[13px] font-medium">{tab.title}</span>
                    <Zap size={12} className={isActive ? "text-amber-500" : "text-white/50"} />
                    {store.tabs.length > 1 && (
                      <button
                        className={`p-0.5 ml-1 rounded-sm flex items-center justify-center
                          ${isActive ? "text-gray-400 hover:text-red-500 hover:bg-red-50" : "text-white/60 hover:text-white hover:bg-white/20"}
                        `}
                        onClick={(e) => {
                          e.stopPropagation();
                          store.closeTab(tab.id);
                        }}
                      >
                        <X size={12} strokeWidth={3} />
                      </button>
                    )}
                  </div>
                );
              })}

              <button
                onClick={() => store.addTab()}
                className="bg-[#00A1BC] hover:bg-[#00B4D1] text-white rounded-t-lg px-2.5 h-[36px] ml-1 flex items-center justify-center transition-colors border-t border-l border-r border-[#00A1BC]"
                title="Tạo đơn mới (F2)"
              >
                <Plus size={18} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="hidden lg:flex items-center gap-3 shrink-0 py-1.5">
          <div className="flex items-center gap-2 px-2 border-r border-white/20">
            <span className="text-sm font-medium">Quản trị viên</span>
            <PosBranchSelect />
          </div>

          <div className="flex items-center gap-1.5">
            <button className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Toàn màn hình" onClick={() => {
              if (!document.fullscreenElement) document.documentElement.requestFullscreen();
              else document.exitFullscreen();
            }}>
              <Maximize size={18} />
            </button>
            <Link href="/" target="_blank" className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Về trang quản lý">
              <Home size={18} />
            </Link>
            <div className="p-1.5 hover:bg-white/20 rounded transition-colors" title="Cài đặt">
              <PosSettingsPanel />
            </div>
            <PosNotifications />
          </div>

          <button
            className="flex items-center gap-2 bg-white/15 hover:bg-white/25 text-white px-3 py-1.5 rounded text-sm font-bold transition-colors"
            title="Chốt sổ tiền mặt"
            onClick={() => setShowShiftClosingModal(true)}
          >
            <NotebookText size={16} />
            <span>Chốt sổ</span>
          </button>

          <button
            className="flex items-center gap-2 bg-[#006E82] hover:bg-[#005767] text-white px-3 py-1.5 rounded text-sm font-bold transition-colors ml-1"
            title="Lưu nháp / Thoát"
            onClick={() => {
              if (window.confirm('Bạn có chắc chắn muốn thoát POS?')) {
                window.location.href = '/';
              }
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </header>

      {/* â• â• â•  MAIN POS AREA â• â• â•  */}
      <main className="flex-1 flex flex-col lg:grid lg:grid-cols-[1fr_390px] xl:grid-cols-[1fr_420px] lg:grid-rows-[auto_1fr_auto] overflow-y-auto lg:overflow-hidden bg-[#f0f2f5] relative">

        {/* 3. CART VIEW (Mobile: 3rd, Desktop: Left Col, Row 1-3) */}
        <div className="order-3 lg:col-start-1 lg:row-start-1 lg:row-span-3 flex flex-col bg-white shadow-sm z-10 lg:overflow-hidden min-h-[400px]">

          {/* Table Header */}
          <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-2 bg-gray-50 border-b border-gray-200 text-[13px] font-semibold text-gray-600 uppercase">
            <div className="text-center">#</div>
            <div></div>
            <div className="text-center">Ảnh</div>
            <div>Sản phẩm / SKU</div>
            <div className="text-center">Đơn vị</div>
            <div className="text-center">Số lượng</div>
            <div className="text-right">Đơn giá</div>
            <div className="text-right">Thành tiền</div>
          </div>

          {/* Table Body (Scrollable) */}
          <div className="flex-1 overflow-y-auto w-full no-scrollbar">
            {activeTab.cart.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                <ShoppingCart size={64} className="opacity-20" />
                <p className="text-lg">Đơn hàng trống</p>
                <p className="text-sm">Hãy tìm kiếm sản phẩm hoặc quét mã vạch (F1)</p>
              </div>
            ) : (
              activeTab.cart.map((item, idx) => {
                const {
                  itemVariants,
                  trueVariants,
                  allConversionVariants,
                  currentVariantObj,
                  isCurrentConversion,
                  currentTrueVariant,
                  conversionVariants,
                  sellableQty,
                  isOverSellableQty,
                } = resolveCartItemStockState(item, activeTab.branchId);
                const weightBandLabel = getCartItemWeightBandLabel(item);

                const currentQuantity = item.quantity || 1;
                const itemDiscountAmount = item.discountItem || 0;
                const discountedUnitPrice = Math.max(0, (item.unitPrice || 0) - itemDiscountAmount);
                const itemDiscountPercent = item.unitPrice && item.unitPrice > 0 ? Math.round((itemDiscountAmount / item.unitPrice) * 100) : 0;

                return (
                  <div key={item.id} id={`cart-row-${item.id}`} className={`flex flex-col border-b border-gray-100 hover:bg-primary-50/30 transition-colors group ${idx === selectedRowIndex ? 'bg-primary-50/30' : ''}`}>

                    {/* â”€â”€â”€ DESKTOP ROW â”€â”€â”€ */}
                    <div className="hidden lg:grid grid-cols-[40px_30px_60px_1fr_80px_120px_120px_120px] gap-2 items-center px-4 py-3">
                      <div className="text-center text-gray-500 text-[15px] font-medium">{idx + 1}</div>

                      <div className="flex justify-center">
                        <button
                          onClick={() => store.removeItem(item.id)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors opacity-0 group-hover:opacity-100"
                          title="Xoá"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>

                      <div className="flex items-center justify-center">
                        <div className="w-10 h-10 rounded border border-gray-200 flex items-center justify-center bg-white text-gray-400 relative group/img cursor-pointer hover:z-50">
                          {item.image ? (
                            <>
                              <Image src={item.image} alt={item.description} width={40} height={40} unoptimized className="h-full w-full rounded object-cover" />
                              {/* Hover 5x image */}
                              <div className="absolute top-1/2 left-full ml-2 w-[200px] h-[200px] -translate-y-1/2 shadow-2xl rounded-lg border-4 border-white overflow-hidden opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible pointer-events-none transition-all z-[999] origin-left">
                                <Image src={item.image} alt={item.description} width={200} height={200} unoptimized className="h-full w-full object-cover" />
                              </div>
                            </>
                          ) : (
                            item.type === 'service' || item.type === 'grooming' ? <Scissors size={18} /> : <Package size={18} />
                          )}
                        </div>
                      </div>

                      <div className="flex flex-col pr-2 min-w-0">
                        <div className="font-semibold text-[15px] text-gray-800 flex items-center gap-2 min-w-0" title={item.description}>
                          <span className="truncate shrink">{item.description}</span>
                          {trueVariants.length > 0 && trueVariants.some((v: any) => v.name !== item.description && v.name !== `${item.description} - Default`) && (
                            <div className="relative inline-flex items-center shrink-0 group cursor-pointer -ml-1">
                              <select
                                className="appearance-none bg-transparent text-primary-600 text-[15px] font-semibold pr-4 pl-1 outline-none cursor-pointer hover:text-primary-700 transition-colors leading-normal"
                                value={currentTrueVariant?.id || (!isCurrentConversion && item.productVariantId) || ''}
                                onChange={(e) => {
                                  const newTrueVariantId = e.target.value;
                                  let targetVariantId = newTrueVariantId;
                                  if (isCurrentConversion && currentTrueVariant && currentVariantObj) {
                                    const suffix = currentVariantObj.name.substring(currentTrueVariant.name.length);
                                    const newTrueVariant = trueVariants.find((v: any) => v.id === newTrueVariantId);
                                    if (newTrueVariant && allConversionVariants) {
                                      const matchingConv = allConversionVariants.find((c: any) => c.name === newTrueVariant.name + suffix);
                                      if (matchingConv) {
                                        targetVariantId = matchingConv.id;
                                      }
                                    }
                                  }
                                  store.updateItemVariant(item.id, targetVariantId);
                                }}
                              >
                                <option value="base" className="hidden">Phiên bản</option>
                                {trueVariants.map((v: any) => (
                                  <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-primary-500/50 group-hover:text-primary-600 pointer-events-none transition-colors" size={14} />
                            </div>
                          )}

                          {/* Stock Popover */}
                          <div className="group/stock relative shrink-0 z-[60] flex">
                            <Info size={16} className="text-gray-300 opacity-0 group-hover:opacity-100 group-hover/stock:text-[#0089A1] cursor-help transition-all" />
                            <div className="absolute top-full left-1/2 -translate-x-[40%] mt-2 w-[340px] opacity-0 invisible group-hover/stock:opacity-100 group-hover/stock:visible group-hover/stock:pointer-events-auto transition-all duration-200 p-0 pointer-events-none before:absolute before:-top-4 before:left-0 before:w-full before:h-4 z-[100]">
                              <div className="bg-white border border-gray-200 shadow-xl rounded-xl overflow-hidden w-full h-full">
                                <div className="bg-gray-50 px-4 py-3 border-b border-gray-100">
                                  <Link
                                    href={item.productId ? `/products/${item.productId}` : '#'}
                                    target="_blank"
                                    className="font-bold text-[13px] text-gray-800 hover:text-[#0089A1] hover:underline leading-tight block cursor-pointer transition-colors"
                                  >
                                    {currentTrueVariant ? currentTrueVariant.name : item.description}
                                  </Link>
                                  <div className="text-[10px] text-gray-500 mt-0.5 font-medium tracking-wide uppercase">{currentTrueVariant ? (currentTrueVariant.sku || item.sku || 'N/A') : (item.sku || 'N/A')}</div>
                                </div>

                                <div className="px-4 py-3">
                                  <table className="w-full text-xs text-right whitespace-nowrap">
                                    <thead>
                                      <tr className="border-b border-gray-100 text-gray-500">
                                        <th className="text-left font-semibold pb-2"></th>
                                        <th className="font-semibold pb-2 px-2">TỒN</th>
                                        <th className="font-semibold pb-2 px-2 text-[#0089A1]">KHẢ DỤNG</th>
                                        <th className="font-semibold pb-2 pl-2">ĐỂ BÁN</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {(() => {
                                        const targetStockInfo = currentTrueVariant ? currentTrueVariant : item;
                                        const targetBranchStocks = Array.isArray((targetStockInfo as any).branchStocks) ? (targetStockInfo as any).branchStocks : [];
                                        const isService = item.type !== 'product';
                                        const defaultFallback = isService ? '∞' : '—';

                                        return (
                                          <>
                                            <tr className="border-b border-gray-50">
                                              <td className="text-left py-2.5 font-semibold text-gray-800">Tổng tồn kho</td>
                                              <td className="px-2 py-2.5">{isService ? defaultFallback : ((targetStockInfo as any).stock ?? defaultFallback)}</td>
                                              <td className="px-2 py-2.5 text-[#0089A1] font-bold">
                                                {isService ? defaultFallback : ((targetStockInfo as any).availableStock !== undefined
                                                  ? (targetStockInfo as any).availableStock
                                                  : (((targetStockInfo as any).stock !== undefined && (targetStockInfo as any).stock !== null)
                                                    ? (targetStockInfo as any).stock - ((targetStockInfo as any).trading || (targetStockInfo as any).reserved || 0)
                                                    : defaultFallback))}
                                              </td>
                                              <td className="pl-2 py-2.5">{isService ? defaultFallback : ((targetStockInfo as any).trading ?? defaultFallback)}</td>
                                            </tr>
                                            {branches.filter((b: any) => b.isActive).map((b: any) => {
                                              const bs = targetBranchStocks.find((s: any) => s.branchId === b.id || s.branch?.id === b.id);
                                              const stock = bs ? bs.stock ?? 0 : 0;
                                              const reserved = bs ? bs.reservedStock ?? 0 : 0;
                                              const availableStock = bs !== undefined && bs !== null && bs.availableStock !== undefined && bs.availableStock !== null
                                                ? bs.availableStock
                                                : (stock - reserved);

                                              return (
                                                <tr key={b.id} className="border-b border-gray-50 last:border-0 border-dashed">
                                                  <td className="text-left py-2 font-medium text-gray-600 truncate max-w-[120px]">{b.name}</td>
                                                  <td className="px-2 py-2">{isService ? defaultFallback : stock}</td>
                                                  <td className="px-2 py-2 text-[#0089A1]/80">{isService ? defaultFallback : availableStock}</td>
                                                  <td className="pl-2 py-2">{defaultFallback}</td>
                                                </tr>
                                              );
                                            })}
                                          </>
                                        );
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="text-xs flex items-center mt-0.5 mb-1 w-full gap-2 group/note min-h-[20px]">
                          <span className="text-gray-500 shrink-0 font-medium text-[13px]">{item.sku || 'N/A'}</span>
                          {weightBandLabel ? (
                            <span className="shrink-0 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-semibold text-primary-700">
                              {weightBandLabel}
                            </span>
                          ) : null}
                          {noteEditingId === item.id ? (
                            <input
                              type="text"
                              placeholder="Ghi chú sản phẩm..."
                              defaultValue={item.itemNotes || ''}
                              autoFocus
                              onBlur={(e) => {
                                if (e.target.value !== item.itemNotes) {
                                  store.updateItemNotes(item.id, e.target.value);
                                }
                                setNoteEditingId(null);
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                  store.updateItemNotes(item.id, e.currentTarget.value);
                                  setNoteEditingId(null);
                                } else if (e.key === 'Escape') {
                                  setNoteEditingId(null);
                                }
                              }}
                              className="flex-1 min-w-[80px] h-6 px-1.5 text-[11px] bg-white/50 border border-amber-300 focus:border-amber-500 focus:bg-white focus:outline-none rounded transition-all text-amber-700 placeholder:text-gray-400"
                            />
                          ) : (
                            <div
                              className="flex items-center gap-1 cursor-pointer hover:opacity-75 transition-opacity"
                              onClick={() => setNoteEditingId(item.id)}
                              title={item.itemNotes ? "Sửa ghi chú" : "Thêm ghi chú"}
                            >
                              {item.itemNotes ? (
                                <span className="text-[11px] text-amber-600 font-medium italic truncate max-w-[200px] flex items-center gap-1">
                                  <FileText size={12} className="shrink-0 text-amber-500" />
                                  {item.itemNotes}
                                </span>
                              ) : (
                                <button className="text-gray-300 hover:text-[#0089A1] transition-colors p-0.5" type="button">
                                  <FileText size={12} strokeWidth={2.5} />
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                        {item.hotelDetails && (
                          <div className="text-[10px] text-primary-600 mt-0.5 bg-primary-50 w-fit px-1 rounded">
                            In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()}
                            {' - '}
                            Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      <div className="text-center text-[15px] font-medium text-gray-700 flex justify-center">
                        {conversionVariants.length > 0 ? (
                          <div className="relative inline-flex items-center group cursor-pointer text-gray-700 hover:text-primary-600 transition-colors">
                            <select
                              className="appearance-none bg-transparent text-[15px] font-medium outline-none cursor-pointer pr-4 w-full text-center"
                              value={isCurrentConversion ? item.productVariantId : 'base'}
                              onChange={(e) => {
                                if (e.target.value === 'base') {
                                  store.updateItemVariant(item.id, currentTrueVariant ? currentTrueVariant.id : 'base');
                                } else {
                                  store.updateItemVariant(item.id, e.target.value);
                                }
                              }}
                            >
                              <option value="base">{item.unit || 'cái'}</option>
                              {conversionVariants.map((v: any) => (
                                <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50 group-hover:opacity-100" size={14} />
                          </div>
                        ) : (
                          <span className="text-gray-700">
                            {item.unit || 'cái'}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-center">
                        <div
                          className={`flex items-center rounded overflow-hidden h-8 transition-colors ${item.type === 'hotel'
                            ? 'border-gray-200 bg-gray-50'
                            : isOverSellableQty
                              ? 'border border-red-500 bg-red-50'
                              : 'border border-gray-300 bg-white focus-within:border-primary-500'
                            }`}
                        >
                          <button
                            className={`px-2 h-full transition-colors ${item.type === 'hotel' ? 'text-gray-400 cursor-not-allowed opacity-50' : isOverSellableQty ? 'text-red-600 hover:bg-red-100' : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            disabled={item.type === 'hotel'}
                            onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) - getCartQuantityStep(item))}
                          >
                            <Minus size={14} />
                          </button>
                          <input
                            id={`quantity-input-${item.id}`}
                            type="text"
                            readOnly
                            disabled={item.type === 'hotel'}
                            value={item.quantity ?? 1}
                            onChange={(e) => {
                              const v = parseCartQuantityInput(e.target.value);
                              store.updateQuantity(item.id, Number.isNaN(v) ? getCartQuantityStep(item) : v);
                            }}
                            className={`w-10 text-center font-bold text-[15px] outline-none border-none h-full cursor-default ${item.type === 'hotel' ? 'bg-gray-50 text-gray-500' : isOverSellableQty ? 'bg-red-50 text-red-600' : 'bg-transparent text-gray-900'
                              }`}
                          />
                          <button
                            className={`px-2 h-full transition-colors ${item.type === 'hotel' ? 'text-gray-400 cursor-not-allowed opacity-50' : isOverSellableQty ? 'text-red-600 hover:bg-red-100' : 'text-gray-500 hover:bg-gray-100'
                              }`}
                            disabled={item.type === 'hotel'}
                            onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) + getCartQuantityStep(item))}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>

                      <div className="relative text-right flex items-center justify-end">
                        {discountEditingId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setDiscountEditingId(null)} />
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 w-72 z-50 p-4 animate-in fade-in zoom-in-95 duration-200 cursor-default text-left shadow-primary-500/10">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                                <h4 className="font-bold text-gray-800 text-[15px]">Cài đặt giá & Chiết khấu</h4>
                                <button className="text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setDiscountEditingId(null)}><X size={18} /></button>
                              </div>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (VNĐ)</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                        placeholder="0"
                                        value={item.discountItem ? money(item.discountItem) : ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value.replace(/\D/g, ''));
                                          store.updateDiscountItem(item.id, isNaN(val) ? 0 : val);
                                        }}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">đ</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (%)</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                        placeholder="0"
                                        value={itemDiscountAmount > 0 && item.unitPrice ? itemDiscountPercent : ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                                          const pct = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
                                          store.updateDiscountItem(item.id, Math.round((item.unitPrice || 0) * (pct / 100)));
                                        }}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">%</span>
                                    </div>
                                  </div>
                                </div>
                                {(item.discountItem ?? 0) > 0 && (
                                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[13px]">
                                    <span className="text-gray-500">Giảm giá:</span>
                                    <span className="font-bold text-amber-600">-{money(itemDiscountAmount)} ({itemDiscountPercent}%)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        <div
                          className="group/price relative cursor-pointer flex flex-col items-end"
                          onClick={() => setDiscountEditingId(item.id)}
                        >
                          <div className="text-[15px] font-medium text-gray-800 border-b border-dashed border-gray-300 hover:border-primary-500 group-hover/price:border-primary-500 transition-colors pb-0.5">
                            {money(discountedUnitPrice)}
                          </div>
                          {itemDiscountAmount > 0 && (
                            <div className="flex items-center gap-1 mt-0.5 text-[11px] font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded max-w-full">
                              <span>-{itemDiscountPercent}%</span>
                              <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="text-right text-[15px] font-bold text-gray-800">
                        {moneyRaw(discountedUnitPrice * currentQuantity)}
                      </div>
                    </div>

                    {/* â”€â”€â”€ MOBILE ROW â”€â”€â”€ */}
                    <div className="flex lg:hidden p-3 gap-3 relative">
                      <div className="w-[60px] h-[60px] shrink-0 rounded border border-gray-200 flex items-center justify-center bg-white text-gray-400 relative group/img cursor-pointer hover:z-50">
                        {item.image ? (
                          <>
                            <Image src={item.image} alt={item.description} width={60} height={60} unoptimized className="h-full w-full rounded object-cover" />
                            {/* Hover 5x image */}
                            <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] shadow-2xl rounded-xl border-4 border-white overflow-hidden opacity-0 invisible group-hover/img:opacity-100 group-hover/img:visible pointer-events-none transition-all z-[999]">
                              <Image src={item.image} alt={item.description} width={300} height={300} unoptimized className="h-full w-full object-cover" />
                            </div>
                          </>
                        ) : (
                          item.type === 'service' || item.type === 'grooming' ? <Scissors size={24} /> : <Package size={24} />
                        )}
                      </div>

                      <div className="flex-1 flex flex-col pr-8">
                        <div className="font-semibold text-[15px] text-gray-800 leading-tight mb-1 flex items-center gap-2 flex-wrap" title={item.description}>
                          <span>{item.description}</span>
                          {trueVariants.length > 0 && trueVariants.some((v: any) => v.name !== item.description && v.name !== `${item.description} - Default`) && (
                            <div className="relative inline-flex items-center shrink-0 group cursor-pointer -ml-1">
                              <select
                                className="appearance-none bg-transparent text-primary-600 text-[15px] font-semibold pr-4 pl-1 outline-none cursor-pointer hover:text-primary-700 transition-colors leading-normal"
                                value={currentTrueVariant?.id || (!isCurrentConversion && item.productVariantId) || ''}
                                onChange={(e) => {
                                  const newTrueVariantId = e.target.value;
                                  let targetVariantId = newTrueVariantId;
                                  if (isCurrentConversion && currentTrueVariant && currentVariantObj) {
                                    const suffix = currentVariantObj.name.substring(currentTrueVariant.name.length);
                                    const newTrueVariant = trueVariants.find((v: any) => v.id === newTrueVariantId);
                                    if (newTrueVariant && allConversionVariants) {
                                      const matchingConv = allConversionVariants.find((c: any) => c.name === newTrueVariant.name + suffix);
                                      if (matchingConv) {
                                        targetVariantId = matchingConv.id;
                                      }
                                    }
                                  }
                                  store.updateItemVariant(item.id, targetVariantId);
                                }}
                              >
                                <option value="base" className="hidden">Phiên bản</option>
                                {trueVariants.map((v: any) => (
                                  <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 text-primary-500/50 group-hover:text-primary-600 pointer-events-none transition-colors" size={14} />
                            </div>
                          )}

                          {/* Mobile Stock Popover */}
                          <Info size={16} className="text-[#0089A1] ml-1 cursor-pointer" onClick={() => window.alert(`Tổng tồn: ${(item as any).stock ?? 'N/A'}\nKhả dụng: ${(item as any).availableStock ?? 'N/A'}`)} />

                          {conversionVariants.length > 0 && (
                            <div className="relative inline-flex items-center shrink-0 mt-0.5 ml-2 cursor-pointer text-gray-700 hover:text-primary-600 transition-colors">
                              <select
                                className="appearance-none bg-transparent text-[14px] font-medium outline-none cursor-pointer pr-4 w-full"
                                value={isCurrentConversion ? item.productVariantId : 'base'}
                                onChange={(e) => {
                                  if (e.target.value === 'base') {
                                    store.updateItemVariant(item.id, currentTrueVariant ? currentTrueVariant.id : 'base');
                                  } else {
                                    store.updateItemVariant(item.id, e.target.value);
                                  }
                                }}
                              >
                                <option value="base">{item.unit || 'cái'}</option>
                                {conversionVariants.map((v: any) => (
                                  <option key={v.id} value={v.id}>{v.name.split(' - ').pop() || v.name}</option>
                                ))}
                              </select>
                              <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" size={14} />
                            </div>
                          )}
                        </div>
                        <div className="text-[13px] text-gray-500 mb-0.5 uppercase tracking-wide">
                          SKU: {item.sku || 'N/A'}
                          {weightBandLabel ? ` · Hạng cân: ${weightBandLabel}` : ''}
                        </div>
                        {discountEditingId === item.id && (
                          <>
                            <div className="fixed inset-0 z-40 cursor-default" onClick={() => setDiscountEditingId(null)} />
                            <div className="absolute top-full right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-200 w-72 z-50 p-4 animate-in fade-in zoom-in-95 duration-200 cursor-default text-left shadow-primary-500/10">
                              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-3">
                                <h4 className="font-bold text-gray-800 text-[15px]">Cài đặt giá & Chiết khấu</h4>
                                <button className="text-gray-400 hover:text-gray-600 transition-colors" onClick={() => setDiscountEditingId(null)}><X size={18} /></button>
                              </div>
                              <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                  <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (VNĐ)</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                        placeholder="0"
                                        value={item.discountItem ? money(item.discountItem) : ''}
                                        onChange={(e) => {
                                          const val = parseInt(e.target.value.replace(/\D/g, ''));
                                          store.updateDiscountItem(item.id, isNaN(val) ? 0 : val);
                                        }}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">đ</span>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-[13px] font-medium text-gray-600 mb-1">CK (%)</label>
                                    <div className="relative">
                                      <input
                                        type="text"
                                        className="w-full text-right text-[14px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded px-2.5 py-1.5 outline-none focus:border-amber-500 pr-6 transition-colors placeholder:text-amber-300"
                                        placeholder="0"
                                        value={itemDiscountAmount > 0 && item.unitPrice ? itemDiscountPercent : ''}
                                        onChange={(e) => {
                                          const val = parseFloat(e.target.value.replace(/[^\d.]/g, ''));
                                          const pct = isNaN(val) ? 0 : Math.min(100, Math.max(0, val));
                                          store.updateDiscountItem(item.id, Math.round((item.unitPrice || 0) * (pct / 100)));
                                        }}
                                      />
                                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[12px] font-medium text-amber-500 select-none">%</span>
                                    </div>
                                  </div>
                                </div>
                                {(item.discountItem ?? 0) > 0 && (
                                  <div className="pt-2 border-t border-gray-100 flex justify-between items-center text-[13px]">
                                    <span className="text-gray-500">Giảm giá:</span>
                                    <span className="font-bold text-amber-600">-{money(itemDiscountAmount)} ({itemDiscountPercent}%)</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </>
                        )}
                        <div className="text-[15px] font-medium text-gray-800 cursor-pointer border-b border-dashed border-gray-300 hover:border-primary-500 group-hover:border-primary-500 transition-colors w-fit pb-0.5" onClick={() => setDiscountEditingId(item.id)}>
                          {moneyRaw(discountedUnitPrice)}
                        </div>
                        {itemDiscountAmount > 0 && (
                          <div className="text-[11px] flex items-center gap-1 font-semibold text-amber-500 bg-amber-50 px-1 py-0.5 rounded w-fit mt-0.5">
                            <span>-{itemDiscountPercent}%</span>
                            <span className="opacity-70">(-{money(itemDiscountAmount)})</span>
                          </div>
                        )}
                        {item.hotelDetails && (
                          <div className="text-[10px] text-primary-600 mt-1 bg-primary-50 w-fit px-1.5 py-0.5 rounded">
                            In: {new Date(item.hotelDetails.checkIn).toLocaleDateString()}
                            {' - '}
                            Out: {new Date(item.hotelDetails.checkOut).toLocaleDateString()}
                          </div>
                        )}
                      </div>

                      {/* Delete item button */}
                      <button
                        onClick={() => store.removeItem(item.id)}
                        className="absolute top-2 right-2 p-1 text-gray-400 hover:text-red-500"
                      >
                        <X size={20} />
                      </button>

                      {/* Quantity control */}
                      <div className="absolute bottom-2 right-2">
                        <div
                          className={`flex items-center rounded overflow-hidden h-[32px] transition-colors ${item.type === 'hotel'
                            ? 'border-gray-200 bg-gray-50'
                            : isOverSellableQty
                              ? 'border border-red-500 bg-red-50 text-red-600'
                              : 'border border-gray-300 bg-white text-gray-700'
                            }`}
                        >
                          <button
                            className={`px-2.5 h-full flex items-center justify-center transition-colors ${item.type === 'hotel' ? 'text-gray-400 cursor-not-allowed opacity-50' : isOverSellableQty ? 'hover:bg-red-100' : 'hover:bg-gray-100'
                              }`}
                            disabled={item.type === 'hotel'}
                            onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) - getCartQuantityStep(item))}
                          >
                            <Minus size={16} />
                          </button>
                          <input
                            id={`quantity-input-mobile-${item.id}`}
                            type="text"
                            readOnly
                            disabled={item.type === 'hotel'}
                            value={item.quantity ?? 1}
                            onChange={(e) => {
                              const v = parseCartQuantityInput(e.target.value);
                              store.updateQuantity(item.id, Number.isNaN(v) ? getCartQuantityStep(item) : v);
                            }}
                            className={`w-10 text-center font-bold text-[14px] outline-none border-none h-full cursor-default ${item.type === 'hotel' ? 'bg-gray-50 text-gray-500' : isOverSellableQty ? 'bg-red-50 text-red-600' : 'bg-transparent text-gray-700'
                              }`}
                          />
                          <button
                            className={`px-2.5 h-full flex items-center justify-center transition-colors ${item.type === 'hotel' ? 'text-gray-400 cursor-not-allowed opacity-50' : isOverSellableQty ? 'hover:bg-red-100' : 'hover:bg-gray-100'
                              }`}
                            disabled={item.type === 'hotel'}
                            onClick={() => store.updateQuantity(item.id, (item.quantity ?? 1) + getCartQuantityStep(item))}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Bottom Toolbar & Notes */}
          <div className="mt-auto flex flex-col bg-gray-50 border-t border-gray-200">
            <div className="flex items-center gap-2 p-2 px-4 shadow-[0_-2px_10px_rgba(0,0,0,0.02)] z-10 overflow-x-auto no-scrollbar whitespace-nowrap">
              <button
                className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors"
                onClick={() => {
                  const check = window.confirm('Xác nhận làm mới Đơn hàng?');
                  if (check) store.clearCart();
                }}
              >Xoá tất cả</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Khuyến mại</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Đổi trả hàng</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">Xem đơn hàng</button>
              <button className="px-4 py-1.5 text-sm bg-white border border-gray-200 text-gray-700 rounded hover:border-primary-500 transition-colors">In phiếu</button>

              <div className="flex-1"></div>

              <button
                onClick={() => setShowHotelCheckout(true)}
                className="px-4 py-1.5 text-sm bg-amber-50 border border-amber-200 text-amber-700 rounded hover:bg-amber-100 transition-colors font-medium"
              >
                + Trả chuồng (Hotel)
              </button>

              <button className="px-4 py-1.5 text-sm bg-primary-50 border border-primary-200 text-primary-700 rounded hover:bg-primary-100 transition-colors font-medium">
                + Sản phẩm tạm
              </button>
            </div>

            <div className="p-2 px-4 bg-white border-t border-gray-200">
              <input
                type="text"
                placeholder="Gõ để ghi chú đơn hàng..."
                className="w-full text-sm outline-none border-none py-1 placeholder:text-gray-400 italic"
                value={activeTab.notes || ''}
                onChange={(e) => store.setNotes(e.target.value)}
              />
            </div>
          </div>
        </div>

        {/* 1. CUSTOMER & PETS (Mobile: 1st, Desktop: Right Col, Row 1) */}
        <div className="order-1 lg:col-start-2 lg:row-start-1 bg-white border-b lg:border-l lg:border-b-0 border-gray-200 z-30 relative">
          <PosCustomerV1
            onSelectSuggestedService={handleSelectSuggestedService}
          />
        </div>

        {/* 4. CALCULATION AREA (Mobile: 4th, Desktop: Right Col, Row 2) */}
        <div className="order-4 lg:col-start-2 lg:row-start-2 bg-white lg:border-l border-gray-200 z-20 flex-1 flex flex-col p-4 overflow-y-auto">

          <div className="mt-auto flex flex-col gap-4">
            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium text-gray-600">Tổng tiền ({cartCount} SP)</span>
              <span className="text-[15px] font-bold">{moneyRaw(activeTab.cart.reduce((sum, item) => sum + (item.unitPrice || 0) * (item.quantity || 1), 0))}</span>
            </div>

            {(() => {
              const totalItemDiscount = activeTab.cart.reduce((sum, item) => sum + ((item.discountItem || 0) * (item.quantity || 1)), 0);
              if (totalItemDiscount > 0) {
                return (
                  <div className="flex justify-between items-center py-1 text-[15px] text-amber-600">
                    <span>Chiết khấu SP</span>
                    <span className="font-semibold">-{moneyRaw(totalItemDiscount)}</span>
                  </div>
                );
              }
              return null;
            })()}

            <div className="flex justify-between items-center py-1 border-b border-dashed border-gray-300 pb-3">
              <span className="text-[15px] text-primary-600 cursor-pointer hover:underline decoration-dashed decoration-primary-400 underline-offset-4">Chiết khấu đơn (F6)</span>
              <div className="flex items-center">
                <input
                  className="w-24 text-right text-[15px] border-b border-gray-300 outline-none focus:border-primary-500 pb-0.5"
                  value={manualDiscountTotal > 0 ? money(manualDiscountTotal) : '0'}
                  onChange={(e) => {
                    const v = parseInt(e.target.value.replace(/\D/g, ''));
                    store.setDiscount(isNaN(v) ? 0 : v);
                  }}
                />
              </div>
            </div>


            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] font-medium text-gray-600">VAT (0%)</span>
              <span className="text-[15px] font-semibold text-gray-800">0</span>
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-[14px] sm:text-[15px] font-bold text-gray-800">KHÁCH PHẢI TRẢ</span>
              <span className="text-[18px] sm:text-[20px] font-bold text-red-600">{moneyRaw(cartTotal)}</span>
            </div>

            <div className="mt-1 sm:mt-2 rounded-2xl border border-gray-200 bg-gray-50/80 p-3 sm:p-4">
              {isMultiPaymentSummary ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[14px] sm:text-[15px] font-medium text-gray-600">Khách đưa</span>
                    {allowMultiPayment ? (
                      <button type="button" onClick={() => setShowPaymentModal(true)} className="text-xs font-semibold text-primary-600 hover:underline">
                        Nhiều hình thức
                      </button>
                    ) : null}
                  </div>
                  <div className="space-y-2">
                    {tabPayments.map((payment, index) => {
                      const method =
                        (payment.paymentAccountId
                          ? visiblePaymentMethods.find((item) => item.id === payment.paymentAccountId) ??
                          paymentMethods.find((item) => item.id === payment.paymentAccountId)
                          : null) ?? null;
                      const colorClasses = getPaymentMethodColorClasses(method?.type ?? 'CASH', method?.colorKey);

                      return (
                        <div key={`${payment.paymentAccountId ?? payment.method}-${index}`} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2">
                          <div className="flex min-w-0 items-center gap-2">
                            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${colorClasses.chip}`}>
                              {method?.name ?? payment.paymentAccountLabel ?? payment.method}
                            </span>
                            <span className="truncate text-xs text-gray-400">{payment.method}</span>
                          </div>
                          <span className="text-sm font-bold text-gray-800">{moneyRaw(Number(payment.amount) || 0)}</span>
                        </div>
                      );
                    })}
                  </div>
                  <div className="space-y-1 border-t border-dashed border-gray-300 pt-2 sm:pt-3">
                    <div className="flex items-center justify-between text-[13px] sm:text-sm">
                      <span className="font-medium text-gray-500">Tổng khách đưa</span>
                      <span className={`font-bold ${multiPaymentTotal >= cartTotal ? 'text-emerald-600' : 'text-amber-600'}`}>
                        {moneyRaw(multiPaymentTotal)}
                      </span>
                    </div>
                    <div className={`text-[11px] sm:text-xs font-semibold ${multiPaymentTotal >= cartTotal ? 'text-emerald-600' : 'text-rose-500'}`}>
                      {multiPaymentTotal >= cartTotal ? 'Đã đủ thanh toán' : `Còn thiếu ${moneyRaw(cartTotal - multiPaymentTotal)}`}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-1.5 sm:gap-3">
                    <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 justify-start">
                      <span className="shrink-0 text-[14px] sm:text-[15px] font-medium text-gray-600 cursor-pointer" onClick={() => document.getElementById('customer_money_input')?.focus()}>
                        Khách đưa (F8)
                      </span>
                      <div ref={paymentMenuRef} className="relative shrink-0 min-w-0">
                        <button
                          type="button"
                          onClick={() => setIsPaymentMenuOpen((current) => !current)}
                          className={`inline-flex items-center max-w-[130px] sm:max-w-[160px] lg:max-w-[140px] gap-1 sm:gap-2 rounded-full border px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-semibold shadow-sm overflow-hidden ${getPaymentMethodColorClasses(currentSinglePaymentMethod?.type ?? 'CASH', currentSinglePaymentMethod?.colorKey).chip
                            }`}
                        >
                          <span className="truncate">{currentSinglePaymentMethod?.name ?? 'Chọn...'}</span>
                          <ChevronDown size={14} className="shrink-0" />
                        </button>

                        {isPaymentMenuOpen ? (
                          <div className="absolute left-1/2 -translate-x-1/2 bottom-full z-40 mb-2 w-[260px] sm:w-72 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
                            <div className="max-h-72 overflow-y-auto p-1.5 space-y-0.5">
                              {visiblePaymentMethods.map((method) => {
                                const colorClasses = getPaymentMethodColorClasses(method.type, method.colorKey);
                                return (
                                  <button
                                    key={method.id}
                                    type="button"
                                    onClick={() => handleSelectSinglePaymentMethod(method)}
                                    className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-left transition-colors hover:bg-gray-50"
                                  >
                                    <div className="flex items-center gap-2 overflow-hidden min-w-0">
                                      <span className={`inline-flex shrink-0 h-2.5 w-2.5 rounded-full ${colorClasses.accent}`} />
                                      <span className="truncate text-[13.5px] font-semibold text-gray-800">{method.name}</span>
                                      <span className="shrink-0 ml-1 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-500">{method.type}</span>
                                    </div>
                                    {currentSinglePaymentMethod?.id === method.id ? <span className="text-primary-600 shrink-0 ml-2 block"><Check size={16} /></span> : null}
                                  </button>
                                );
                              })}
                              {allowMultiPayment ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setIsPaymentMenuOpen(false);
                                    setShowPaymentModal(true);
                                  }}
                                  className="mt-1 flex w-full items-center justify-between rounded-xl border border-dashed border-primary-300 bg-primary-50 px-3 py-2.5 text-left text-[13.5px] font-semibold text-primary-700 transition-colors hover:bg-primary-100"
                                >
                                  <span>Nhiều hình thức</span>
                                  <ChevronDown size={14} className="-rotate-90" />
                                </button>
                              ) : null}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="flex shrink-0 text-right pl-1 pointer-events-auto">
                      {currentSinglePaymentType === 'CASH' ? (
                        <input
                          id="customer_money_input"
                          className="w-20 sm:w-32 border-b border-gray-300 bg-transparent pb-0.5 text-right text-[15px] sm:text-base font-semibold outline-none focus:border-primary-500"
                          value={customerMoneyInput}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            setCustomerMoneyInput(val ? money(parseInt(val, 10)) : '');
                          }}
                          placeholder={money(cartTotal)}
                        />
                      ) : (
                        <span className="text-base font-semibold text-gray-800">{moneyRaw(cartTotal)}</span>
                      )}
                    </div>
                  </div>

                  {currentSinglePaymentType === 'CASH' ? (
                    <div className="grid grid-cols-3 gap-2">
                      {quickCashSuggestions.map((amount) => (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => setCustomerMoneyInput(money(amount))}
                          className="rounded-full bg-white px-3 py-2 text-sm font-medium text-gray-600 shadow-sm ring-1 ring-gray-200 transition-colors hover:bg-gray-50 hover:text-gray-800"
                        >
                          {money(amount)}
                        </button>
                      ))}
                    </div>
                  ) : currentSinglePaymentMethod?.type === 'BANK' && currentSinglePaymentMethod?.accountNumber ? (
                    <div className="truncate rounded-xl bg-gray-50 px-3 py-2 text-[13.5px] text-gray-600 font-medium tracking-tight">
                      {currentSinglePaymentMethod.bankName} • {currentSinglePaymentMethod.accountNumber}
                      {currentSinglePaymentMethod.accountHolder && ` • ${currentSinglePaymentMethod.accountHolder}`}
                    </div>
                  ) : null}
                </div>
              )}
            </div>

            <div className="flex justify-between items-center py-1">
              <span className="text-[15px] text-gray-500">
                {isMultiPaymentSummary ? 'Trạng thái thanh toán' : 'Tiền thừa'}
              </span>
              <span className={`text-[15px] font-bold ${isMultiPaymentSummary
                ? multiPaymentTotal >= cartTotal
                  ? 'text-emerald-600'
                  : 'text-rose-500'
                : returnMoney > 0
                  ? 'text-gray-800'
                  : 'text-gray-400'
                }`}>
                {isMultiPaymentSummary
                  ? multiPaymentTotal >= cartTotal
                    ? 'Đã đủ'
                    : `Còn thiếu ${moneyRaw(cartTotal - multiPaymentTotal)}`
                  : guestMoney === 0
                    ? '0'
                    : moneyRaw(returnMoney)}
              </span>
            </div>
          </div>

        </div>

        {/* 5. BUTTONS AREA (Mobile: 5th, Desktop: Right Col, Row 3) */}
        <div className="order-5 lg:col-start-2 lg:row-start-3 bg-gray-50 border-t border-b lg:border-b-0 lg:border-l border-gray-200 z-20 p-4 flex flex-col gap-3 shadow-[0_-4px_15px_rgba(0,0,0,0.03)]">
          <div className="grid grid-cols-1 gap-3">
            <button
              className="py-2.5 bg-white border border-gray-300 hover:border-primary-500 text-gray-700 rounded-lg text-[13px] font-bold uppercase transition-colors flex items-center justify-center shadow-sm"
              onClick={() => setShowBookingModal(true)}
              disabled={cartCount === 0}
            >
              ĐẶT HÀNG
            </button>
          </div>
          <button
            className={`w-full py-4 text-white text-lg font-bold rounded-lg uppercase shadow-lg transition-transform active:scale-[0.98] ${cartCount > 0 ? 'bg-primary-600 hover:bg-primary-700 shadow-primary-500/30' : 'bg-gray-400 cursor-not-allowed shadow-none'}`}
            onClick={() => {
              if (hasServiceItems) {
                handleCreateServiceFlow();
              } else {
                const method = activeTab.payments && activeTab.payments.length > 0 ? activeTab.payments[0].method : preferredPaymentMethod?.type ?? 'CASH';
                handleCheckout(method as string);
              }
            }}
            disabled={cartCount === 0 || isQrIntentPending}
          >
            {hasServiceItems ? 'Tạo Dịch Vụ (F9)' : 'Thanh Toán (F9)'}
          </button>
        </div>

      </main >

      {/* â• â• â•  MODALS â• â• â•  */}
      <HotelCheckoutModal
        isOpen={showHotelCheckout}
        onClose={() => {
          setShowHotelCheckout(false);
          setSelectedHotelPetId(undefined);
        }}
        customerId={activeTab?.customerId}
        initialSelectedPet={selectedHotelPetId}
        onConfirm={(details) => {
          store.addItem(details);
          setShowHotelCheckout(false);
          setSelectedHotelPetId(undefined);
          toast.success('Đã chọn checkout lưu chuồng');
        }}
      />

      {/* ReceiptModal removed: checkout now redirects to /orders/:id */}

      <PosPaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        cartTotal={cartTotal}
        paymentMethods={visiblePaymentMethods}
        initialPayments={activeTab?.payments ?? []}
        minimumMethods={2}
        onConfirm={handleMultiPaymentConfirm}
      />

      <PosShiftClosingModal
        isOpen={showShiftClosingModal}
        currentShift={shiftCurrentQuery.data ?? null}
        onClose={() => setShowShiftClosingModal(false)}
        onSaved={() => void shiftCurrentQuery.refetch()}
      />

      <PosQrPaymentModal
        isOpen={showQrPaymentModal}
        intent={qrIntentStream.latestIntent?.code === activeQrIntent?.code ? qrIntentStream.latestIntent : activeQrIntent}
        onClose={() => {
          setShowQrPaymentModal(false)
          setActiveQrIntent(null)
        }}
        onRefresh={isQrBankPayment ? () => void handleGenerateQrPayment() : undefined}
        isRefreshing={isQrIntentPending}
      />

      <PosOrderBookingModal
        isOpen={showBookingModal}
        onClose={() => setShowBookingModal(false)}
        cartTotal={cartTotal}
        cartCount={cartCount}
        onConfirm={(date, note) => {
          const finalNote = `[HẸN ĐẾN: ${date.replace('T', ' ')}] ${note}`.trim();
          handleCheckout('UNPAID', finalNote);
          setShowBookingModal(false);
        }}
      />
    </div >
  );
}

export default function PosPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#f0f2f5]">Đang tải...</div>}>
      <PosPageContent />
    </Suspense>
  );
}

