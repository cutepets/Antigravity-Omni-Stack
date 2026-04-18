import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveProductVariantLabels, type CartItem, type OrderTab, type PaymentEntry, type PaymentMethod } from '@petshop/shared';
import { getCartQuantityStep, roundCartQuantity } from '@/app/(dashboard)/_shared/cart/cart.utils';

type PosRoundingUnit = 100 | 1000;

// ─── Default tab factory ──────────────────────────────────────────────────────
const createNewTab = (id?: string, tabNumber?: number): OrderTab => ({
  id: id ?? `tab-${Date.now()}`,
  title: tabNumber != null ? `Đơn ${tabNumber}` : 'Đơn mới',
  customerId: undefined,
  customerName: 'Khách lẻ',
  productSearch: '',
  cart: [],
  payments: [],
  manualDiscountTotal: 0,
  roundingDiscountTotal: 0,
  discountTotal: 0,
  shippingFee: 0,
  notes: '',
  activePetIds: [],
});

const toFiniteNumber = (value: unknown, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const calculateCartSubtotal = (cart: OrderTab['cart']) =>
  cart.reduce(
    (sum, item) =>
      sum +
      (toFiniteNumber(item.unitPrice) - toFiniteNumber(item.discountItem)) * Math.max(0, toFiniteNumber(item.quantity)),
    0,
  );

const normalizeRoundingUnit = (value: unknown): PosRoundingUnit => (Number(value) === 1000 ? 1000 : 100);

const calculateBaseTotal = (tab: OrderTab) =>
  Math.max(0, calculateCartSubtotal(tab.cart) + Math.max(0, toFiniteNumber(tab.shippingFee)));

const calculateRoundingDiscount = (
  amount: number,
  roundingEnabled: boolean,
  roundingUnit: PosRoundingUnit,
) => {
  const safeAmount = Math.max(0, toFiniteNumber(amount));
  if (!roundingEnabled || safeAmount < roundingUnit) return 0;

  return safeAmount - Math.floor(safeAmount / roundingUnit) * roundingUnit;
};

const reconcileTabDiscounts = (
  tab: OrderTab,
  roundingEnabled: boolean,
  roundingUnit: PosRoundingUnit,
): OrderTab => {
  const baseTotal = calculateBaseTotal(tab);
  const manualSeed = toFiniteNumber(tab.manualDiscountTotal ?? tab.discountTotal);
  const manualDiscountTotal = Math.min(baseTotal, Math.max(0, manualSeed));
  const payableBeforeRounding = Math.max(0, baseTotal - manualDiscountTotal);
  const roundingDiscountTotal = Math.min(
    payableBeforeRounding,
    calculateRoundingDiscount(payableBeforeRounding, roundingEnabled, roundingUnit),
  );

  return {
    ...tab,
    shippingFee: Math.max(0, toFiniteNumber(tab.shippingFee)),
    manualDiscountTotal,
    roundingDiscountTotal,
    discountTotal: Math.min(baseTotal, manualDiscountTotal + roundingDiscountTotal),
  };
};

const calculateCartTotal = (tab: OrderTab) =>
  calculateCartSubtotal(tab.cart) - toFiniteNumber(tab.discountTotal) + toFiniteNumber(tab.shippingFee);

// ─── Store Interface ──────────────────────────────────────────────────────────
interface PosStore {
  // ── Multi-tab state ──────────────────────────────────────────
  tabs: OrderTab[];
  activeTabId: string;
  tabCounter: number;
  // ── UI Settings ──────────────────────────────────────────────
  outOfStockHidden: boolean;
  setOutOfStockHidden: (hidden: boolean) => void;
  isMultiSelect: boolean;
  setIsMultiSelect: (val: boolean) => void;

  autoFocusSearch: boolean;
  setAutoFocusSearch: (val: boolean) => void;
  barcodeMode: boolean;
  setBarcodeMode: (val: boolean) => void;
  soundEnabled: boolean;
  setSoundEnabled: (val: boolean) => void;
  zoomLevel: number;
  setZoomLevel: (val: number) => void;
  defaultPayment: string;
  setDefaultPayment: (val: string) => void;
  roundingEnabled: boolean;
  setRoundingEnabled: (val: boolean) => void;
  roundingUnit: PosRoundingUnit;
  setRoundingUnit: (val: PosRoundingUnit) => void;

  // ── Print Settings ───────────────────────────────────────────
  printerIp: string;
  setPrinterIp: (ip: string) => void;
  paperSize: string;
  setPaperSize: (size: string) => void;
  autoPrint: boolean;
  setAutoPrint: (val: boolean) => void;
  autoPrintQR: boolean;
  setAutoPrintQR: (val: boolean) => void;

  receiptData: any | null;
  setReceiptData: (data: any | null) => void;

  // ── Tab Actions ──────────────────────────────────────────────
  addTab: () => void;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  renameTab: (id: string, title: string) => void;

  // ── Cart Actions (on active tab) ─────────────────────────────
  addItem: (item: Omit<CartItem, 'quantity' | 'discountItem' | 'vatRate' | 'unit'> & {
    quantity?: number;
    discountItem?: number;
    vatRate?: number;
    unit?: string;
  }) => void;
  removeItem: (itemId: string) => void;
  updateQuantity: (itemId: string, qty: number) => void;
  updateItemPrice: (itemId: string, price: number) => void;
  updateDiscountItem: (itemId: string, discount: number) => void;
  updateItemNotes: (itemId: string, notes: string) => void;
  updateItemVariant: (itemId: string, variantId: string) => void;
  clearCart: () => void;

  // ── Customer Actions ─────────────────────────────────────────
  setCustomer: (id: string | undefined, name: string) => void;
  togglePet: (petId: string) => void;
  setActivePets: (petIds: string[]) => void;

  // ── Payment Actions ──────────────────────────────────────────
  addPayment: (method: PaymentMethod, amount: number, extra?: Partial<PaymentEntry>) => void;
  removePayment: (index: number) => void;
  updatePaymentAmount: (index: number, amount: number) => void;
  setSinglePayment: (method: PaymentMethod, amount: number, extra?: Partial<PaymentEntry>) => void;
  clearPayments: () => void;

  // ── Order-level Actions ──────────────────────────────────────
  setDiscount: (discount: number) => void;
  setShippingFee: (fee: number) => void;
  setNotes: (notes: string) => void;
  setSearch: (search: string) => void;

  // ── Existing Order (resume payment) ──────────────────────────
  attachLinkedOrder: (data: {
    orderId: string;
    orderNumber: string;
    paymentStatus?: string;
    amountPaid?: number;
    branchId?: string;
  }) => void;

  // ── Branch ───────────────────────────────────────────────────
  setBranch: (branchId: string | undefined) => void;

  // ── Complete reset ───────────────────────────────────────────
  resetActiveTab: () => void;
  resetAll: () => void;
}

// ─── Helper: update active tab ────────────────────────────────────────────────
function updateActiveTab(
  state: Pick<PosStore, 'tabs' | 'activeTabId' | 'roundingEnabled' | 'roundingUnit'>,
  updater: (tab: OrderTab) => Partial<OrderTab>,
) {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeTabId
        ? reconcileTabDiscounts(
          { ...tab, ...updater(tab) },
          state.roundingEnabled,
          state.roundingUnit,
        )
        : tab,
    ),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const usePosStore = create<PosStore>()(
  persist(
    (set, get) => {
      const firstTab = createNewTab('tab-1', 1);

      return {
        tabs: [firstTab],
        activeTabId: firstTab.id,
        tabCounter: 1,
        outOfStockHidden: true,
        setOutOfStockHidden: (hidden) => set({ outOfStockHidden: hidden }),
        isMultiSelect: false,
        setIsMultiSelect: (val) => set({ isMultiSelect: val }),

        autoFocusSearch: true,
        setAutoFocusSearch: (val) => set({ autoFocusSearch: val }),
        barcodeMode: true,
        setBarcodeMode: (val) => set({ barcodeMode: val }),
        soundEnabled: true,
        setSoundEnabled: (val) => set({ soundEnabled: val }),
        zoomLevel: 100,
        setZoomLevel: (val) => set({ zoomLevel: val }),
        defaultPayment: '',
        setDefaultPayment: (val) => set({ defaultPayment: val }),
        roundingEnabled: false,
        setRoundingEnabled: (val) =>
          set((state) => ({
            roundingEnabled: val,
            tabs: state.tabs.map((tab) => reconcileTabDiscounts(tab, val, state.roundingUnit)),
          })),
        roundingUnit: 100,
        setRoundingUnit: (val) => {
          const nextUnit = normalizeRoundingUnit(val);
          set((state) => ({
            roundingUnit: nextUnit,
            tabs: state.tabs.map((tab) => reconcileTabDiscounts(tab, state.roundingEnabled, nextUnit)),
          }));
        },

        printerIp: '',
        setPrinterIp: (ip) => set({ printerIp: ip }),
        paperSize: 'K80',
        setPaperSize: (size) => set({ paperSize: size }),
        autoPrint: true,
        setAutoPrint: (val) => set({ autoPrint: val }),
        autoPrintQR: true,
        setAutoPrintQR: (val) => set({ autoPrintQR: val }),

        receiptData: null,
        setReceiptData: (data) => set({ receiptData: data }),

        // ── Tab Actions ──────────────────────────────────────────
        addTab: () => {
          set((s) => {
            const nextCounter = (s.tabCounter ?? 1) + 1;
            const newTab = createNewTab(undefined, nextCounter);
            return {
              tabs: [...s.tabs, newTab],
              activeTabId: newTab.id,
              tabCounter: nextCounter,
            };
          });
        },

        closeTab: (id) => {
          set((s) => {
            const remaining = s.tabs.filter((t) => t.id !== id);
            if (remaining.length === 0) {
              // Tất cả đơn đã đóng → reset counter về 1
              const fresh = createNewTab('tab-1', 1);
              return { tabs: [fresh], activeTabId: fresh.id, tabCounter: 1 };
            }
            const newActiveId = s.activeTabId === id ? remaining[0].id : s.activeTabId;
            return { tabs: remaining, activeTabId: newActiveId };
          });
        },

        setActiveTab: (id) => set({ activeTabId: id }),

        renameTab: (id, title) =>
          set((s) => ({
            tabs: s.tabs.map((t) => (t.id === id ? { ...t, title } : t)),
          })),

        // ── Cart Actions ─────────────────────────────────────────
        addItem: (rawItem) => {
          const item: CartItem = {
            ...rawItem,
            quantity: rawItem.quantity ?? 1,
            discountItem: rawItem.discountItem ?? 0,
            vatRate: rawItem.vatRate ?? 0,
            unit: rawItem.unit ?? 'cái',
          };

          set((s) =>
            updateActiveTab(s, (tab) => {
              // Check if item already in cart (same id + type)
              const existIdx = tab.cart.findIndex((c) => c.id === item.id && c.type === item.type);
              if (existIdx >= 0) {
                const updated = [...tab.cart];
                updated[existIdx] = {
                  ...updated[existIdx],
                  quantity: updated[existIdx].quantity + (item.quantity),
                };
                return { cart: updated };
              }
              return { cart: [...tab.cart, item] };
            }),
          );
        },

        removeItem: (itemId) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              cart: tab.cart.filter((c) => c.id !== itemId),
            })),
          ),

        updateQuantity: (itemId, qty) =>
          set((state) =>
            updateActiveTab(state, (tab) => ({
              cart: tab.cart.map((i) =>
                i.id === itemId
                  ? {
                    ...i,
                    quantity: roundCartQuantity(
                      Math.max(getCartQuantityStep(i), qty),
                      getCartQuantityStep(i),
                    ),
                  }
                  : i,
              ),
            })),
          ),

        updateItemPrice: (itemId, price) =>
          set((state) =>
            updateActiveTab(state, (tab) => ({
              cart: tab.cart.map((i) => (i.id === itemId ? { ...i, unitPrice: Math.max(0, price) } : i)),
            })),
          ),

        updateDiscountItem: (itemId, discount) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              cart: tab.cart.map((c) =>
                c.id === itemId ? { ...c, discountItem: discount } : c,
              ),
            })),
          ),

        updateItemNotes: (itemId, notes) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              cart: tab.cart.map((c) =>
                c.id === itemId ? { ...c, itemNotes: notes } : c,
              ),
            })),
          ),

        updateItemVariant: (itemId, variantId) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              cart: tab.cart.map((c) => {
                if (c.id === itemId) {
                  // Capture base values if not set yet so we can restore them later
                  const baseSku = c.baseSku ?? c.sku;
                  const baseUnitPrice = c.baseUnitPrice ?? c.unitPrice;
                  const baseUnit = (c as any).baseUnit ?? c.unit ?? 'cái';

                  if (variantId === 'base') {
                    // Reset to base product
                    return {
                      ...c,
                      productVariantId: undefined,
                      variantName: undefined,
                      variantLabel: undefined,
                      unitLabel: undefined,
                      sku: baseSku,
                      unit: baseUnit,
                      unitPrice: baseUnitPrice,
                      baseSku,
                      baseUnitPrice,
                      baseUnit,
                    };
                  }

                  if (c.variants) {
                    let variant: any = c.variants.find((v: any) => v.id === variantId);
                    if (!variant) {
                      for (const v of c.variants as any[]) {
                        if (v.children) {
                          const child = v.children.find((ch: any) => ch.id === variantId);
                          if (child) {
                            variant = child;
                            break;
                          }
                        }
                      }
                    }
                    if (variant) {
                      const productName = c.description ?? '';
                      const normalizedProductName = `${productName}`.trim().toLowerCase();
                      const resolvedLabels = resolveProductVariantLabels(productName, variant);
                      const variantLabel =
                        resolvedLabels.variantLabel &&
                        resolvedLabels.variantLabel.trim().toLowerCase() !== normalizedProductName
                          ? resolvedLabels.variantLabel
                          : undefined;
                      const unitLabel = resolvedLabels.unitLabel ?? undefined;
                      const variantName = [variantLabel, unitLabel].filter(Boolean).join(' • ') || undefined;

                      return {
                        ...c,
                        productVariantId: variant.id,
                        variantName,
                        variantLabel,
                        unitLabel,
                        sku: variant.sku ?? baseSku,
                        unit: unitLabel ?? variant.unit ?? baseUnit,
                        unitPrice: variant.sellingPrice ?? variant.price ?? baseUnitPrice,
                        stock: variant.stock ?? c.stock,
                        availableStock: variant.availableStock ?? c.availableStock,
                        trading: variant.trading ?? c.trading,
                        reserved: variant.reserved ?? c.reserved,
                        branchStocks: variant.branchStocks ?? c.branchStocks,
                        baseSku,
                        baseUnitPrice,
                        baseUnit,
                      };
                    }
                  }
                }
                return c;
              }),
            })),
          ),

        clearCart: () =>
          set((s) =>
            updateActiveTab(s, () => ({
              cart: [],
              payments: [],
              manualDiscountTotal: 0,
              roundingDiscountTotal: 0,
              discountTotal: 0,
              shippingFee: 0,
              notes: '',
            })),
          ),

        // ── Customer ─────────────────────────────────────────────
        setCustomer: (id, name) =>
          set((s) =>
            updateActiveTab(s, () => ({
              customerId: id,
              customerName: name,
              activePetIds: [],
            })),
          ),

        togglePet: (petId) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              activePetIds: tab.activePetIds.includes(petId)
                ? tab.activePetIds.filter((p) => p !== petId)
                : [...tab.activePetIds, petId],
            })),
          ),

        setActivePets: (petIds) =>
          set((s) => updateActiveTab(s, () => ({ activePetIds: petIds }))),

        // ── Payments ─────────────────────────────────────────────
        addPayment: (method, amount, extra) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              payments: [...tab.payments, { method, amount, ...extra }],
            })),
          ),

        removePayment: (index) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              payments: tab.payments.filter((_, i) => i !== index),
            })),
          ),

        updatePaymentAmount: (index, amount) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              payments: tab.payments.map((p, i) =>
                i === index ? { ...p, amount } : p,
              ),
            })),
          ),

        setSinglePayment: (method, amount, extra) =>
          set((s) =>
            updateActiveTab(s, () => ({
              payments: [{ method, amount, ...extra }],
            })),
          ),

        clearPayments: () =>
          set((s) => updateActiveTab(s, () => ({ payments: [] }))),

        // ── Order-level ──────────────────────────────────────────
        setDiscount: (discount) =>
          set((s) => updateActiveTab(s, () => ({ manualDiscountTotal: discount }))),

        setShippingFee: (fee) =>
          set((s) => updateActiveTab(s, () => ({ shippingFee: fee }))),

        setNotes: (notes) =>
          set((s) => updateActiveTab(s, () => ({ notes }))),

        setSearch: (search) =>
          set((s) => updateActiveTab(s, () => ({ productSearch: search }))),

        // ── Load existing order ──────────────────────────────────
        // ── Branch ───────────────────────────────────────────────
        attachLinkedOrder: (data) =>
          set((s) =>
            updateActiveTab(s, () => ({
              title: `#${data.orderNumber}`,
              linkedOrderId: data.orderId,
              linkedOrderNumber: data.orderNumber,
              linkedPaymentStatus: data.paymentStatus,
              linkedAmountPaid: toFiniteNumber(data.amountPaid),
              branchId: data.branchId,
            })),
          ),

        setBranch: (branchId) =>
          set((s) =>
            updateActiveTab(s, () => ({ branchId })),
          ),

        // ── Reset ────────────────────────────────────────────────
        resetActiveTab: () =>
          set((s) => {
            // Nếu chỉ còn 1 tab → reset số về 1 (tránh số phình to)
            const isOnlyTab = s.tabs.length === 1;
            const nextCounter = isOnlyTab ? 1 : (s.tabCounter ?? 1) + 1;
            const fresh = createNewTab(s.activeTabId, nextCounter);
            return {
              tabs: s.tabs.map((t) => (t.id === s.activeTabId ? fresh : t)),
              tabCounter: nextCounter,
            };
          }),

        resetAll: () => {
          const fresh = createNewTab('tab-1', 1);
          set({ tabs: [fresh], activeTabId: fresh.id, tabCounter: 1 });
        },
      };
    },
    {
      name: 'pos-v3-storage',
      partialize: (state) => {
        const draftTabs = state.tabs.filter(t => !t.linkedOrderId);
        const persistTabs = draftTabs.length > 0 ? draftTabs : [createNewTab(`tab-${Date.now()}`)];
        const persistActiveTabId = persistTabs.find(t => t.id === state.activeTabId)
          ? state.activeTabId
          : persistTabs[0].id;

        return {
          tabs: persistTabs,
          activeTabId: persistActiveTabId,
          tabCounter: state.tabCounter,
          outOfStockHidden: state.outOfStockHidden,
          autoFocusSearch: state.autoFocusSearch,
          barcodeMode: state.barcodeMode,
          soundEnabled: state.soundEnabled,
          zoomLevel: state.zoomLevel,
          defaultPayment: state.defaultPayment,
          roundingEnabled: state.roundingEnabled,
          roundingUnit: state.roundingUnit,
          printerIp: state.printerIp,
          paperSize: state.paperSize,
          autoPrint: state.autoPrint,
          autoPrintQR: state.autoPrintQR,
        };
      },
      merge: (persistedState, currentState) => {
        const mergedState = {
          ...currentState,
          ...(persistedState as Partial<PosStore>),
        } as PosStore;
        const roundingUnit = normalizeRoundingUnit(mergedState.roundingUnit);
        const roundingEnabled = Boolean(mergedState.roundingEnabled);
        const tabs =
          mergedState.tabs?.map((tab) => reconcileTabDiscounts(tab, roundingEnabled, roundingUnit)) ??
          currentState.tabs;

        // Tính lại tabCounter từ tên tab hiện có để tránh trùng số sau reload
        const maxTabNumber = tabs.reduce((max, tab) => {
          const match = tab.title?.match(/^Đơn (\d+)$/);
          return match ? Math.max(max, parseInt(match[1], 10)) : max;
        }, mergedState.tabCounter ?? 1);

        return {
          ...mergedState,
          tabs,
          roundingEnabled,
          roundingUnit,
          tabCounter: maxTabNumber,
        };
      },
    },
  ),
);

// ─── Selectors (computed values) ──────────────────────────────────────────────

export const useActiveTab = () =>
  usePosStore((s) => s.tabs.find((t) => t.id === s.activeTabId) ?? s.tabs[0]);

export const useCartSubtotal = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return calculateCartSubtotal(tab.cart);
  });

export const useCartTotal = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return calculateCartTotal(tab);
  });

export const useTotalPaid = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return tab.payments.reduce((sum, p) => sum + toFiniteNumber(p.amount), 0);
  });

export const useCartItemCount = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return tab.cart.reduce((sum, item) => sum + Math.max(0, toFiniteNumber(item.quantity)), 0);
  });
