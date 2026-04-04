import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CartItem, OrderTab, PaymentMethod } from '@petshop/shared';

// ─── Default tab factory ──────────────────────────────────────────────────────
const createNewTab = (id?: string): OrderTab => ({
  id: id ?? `tab-${Date.now()}`,
  title: 'Đơn mới',
  customerId: undefined,
  customerName: 'Khách lẻ',
  productSearch: '',
  cart: [],
  payments: [],
  discountTotal: 0,
  shippingFee: 0,
  notes: '',
  activePetIds: [],
});

// ─── Store Interface ──────────────────────────────────────────────────────────
interface PosStore {
  // ── Multi-tab state ──────────────────────────────────────────
  tabs: OrderTab[];
  activeTabId: string;
  // ── UI Settings ──────────────────────────────────────────────
  outOfStockHidden: boolean;
  setOutOfStockHidden: (hidden: boolean) => void;
  isMultiSelect: boolean;
  setIsMultiSelect: (val: boolean) => void;

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
  addPayment: (method: PaymentMethod, amount: number) => void;
  removePayment: (index: number) => void;
  updatePaymentAmount: (index: number, amount: number) => void;
  setSinglePayment: (method: PaymentMethod, amount: number) => void;
  clearPayments: () => void;

  // ── Order-level Actions ──────────────────────────────────────
  setDiscount: (discount: number) => void;
  setShippingFee: (fee: number) => void;
  setNotes: (notes: string) => void;
  setSearch: (search: string) => void;

  // ── Existing Order (resume payment) ──────────────────────────
  loadExistingOrder: (data: {
    orderId: string;
    orderNumber: string;
    paymentStatus: string;
    amountPaid: number;
    customerId?: string;
    customerName: string;
    cart: CartItem[];
    discountTotal: number;
    shippingFee: number;
    notes: string;
  }) => void;

  // ── Branch ───────────────────────────────────────────────────
  setBranch: (branchId: string | undefined) => void;

  // ── Complete reset ───────────────────────────────────────────
  resetActiveTab: () => void;
  resetAll: () => void;
}

// ─── Helper: update active tab ────────────────────────────────────────────────
function updateActiveTab(
  state: Pick<PosStore, 'tabs' | 'activeTabId'>,
  updater: (tab: OrderTab) => Partial<OrderTab>,
) {
  return {
    tabs: state.tabs.map((tab) =>
      tab.id === state.activeTabId ? { ...tab, ...updater(tab) } : tab,
    ),
  };
}

// ─── Store ────────────────────────────────────────────────────────────────────
export const usePosStore = create<PosStore>()(
  persist(
    (set, get) => {
      const firstTab = createNewTab('tab-1');

      return {
        tabs: [firstTab],
        activeTabId: firstTab.id,
        outOfStockHidden: true,
        setOutOfStockHidden: (hidden) => set({ outOfStockHidden: hidden }),
        isMultiSelect: false,
        setIsMultiSelect: (val) => set({ isMultiSelect: val }),

        // ── Tab Actions ──────────────────────────────────────────
        addTab: () => {
          const newTab = createNewTab();
          set((s) => ({
            tabs: [...s.tabs, newTab],
            activeTabId: newTab.id,
          }));
        },

        closeTab: (id) => {
          set((s) => {
            const remaining = s.tabs.filter((t) => t.id !== id);
            if (remaining.length === 0) {
              const fresh = createNewTab('tab-1');
              return { tabs: [fresh], activeTabId: fresh.id };
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
              cart: tab.cart.map((i) => (i.id === itemId ? { ...i, quantity: Math.max(1, qty) } : i)),
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

                  if (variantId === 'base') {
                    // Reset to base product
                    return {
                      ...c,
                      productVariantId: undefined,
                      variantName: undefined,
                      sku: baseSku,
                      unitPrice: baseUnitPrice,
                      baseSku,
                      baseUnitPrice,
                    };
                  }
                  
                  if (c.variants) {
                    const variant = c.variants.find(v => v.id === variantId);
                    if (variant) {
                      return {
                        ...c,
                        productVariantId: variant.id,
                        variantName: variant.name,
                        sku: variant.sku ?? baseSku,
                        unitPrice: variant.sellingPrice ?? variant.price ?? baseUnitPrice,
                        baseSku,
                        baseUnitPrice,
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
        addPayment: (method, amount) =>
          set((s) =>
            updateActiveTab(s, (tab) => ({
              payments: [...tab.payments, { method, amount }],
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

        setSinglePayment: (method, amount) =>
          set((s) =>
            updateActiveTab(s, () => ({
              payments: [{ method, amount }],
            })),
          ),

        clearPayments: () =>
          set((s) => updateActiveTab(s, () => ({ payments: [] }))),

        // ── Order-level ──────────────────────────────────────────
        setDiscount: (discount) =>
          set((s) => updateActiveTab(s, () => ({ discountTotal: discount }))),

        setShippingFee: (fee) =>
          set((s) => updateActiveTab(s, () => ({ shippingFee: fee }))),

        setNotes: (notes) =>
          set((s) => updateActiveTab(s, () => ({ notes }))),

        setSearch: (search) =>
          set((s) => updateActiveTab(s, () => ({ productSearch: search }))),

        // ── Load existing order ──────────────────────────────────
        loadExistingOrder: (data) => {
          const newTab = createNewTab();
          set((s) => ({
            tabs: [
              ...s.tabs,
              {
                ...newTab,
                title: `#${data.orderNumber}`,
                customerId: data.customerId,
                customerName: data.customerName,
                cart: data.cart,
                discountTotal: data.discountTotal,
                shippingFee: data.shippingFee,
                notes: data.notes,
                existingOrderId: data.orderId,
                existingOrderNumber: data.orderNumber,
                existingPaymentStatus: data.paymentStatus,
                existingAmountPaid: data.amountPaid,
              },
            ],
            activeTabId: newTab.id,
          }));
        },

        // ── Branch ───────────────────────────────────────────────
        setBranch: (branchId) =>
          set((s) =>
            updateActiveTab(s, () => ({ branchId })),
          ),

        // ── Reset ────────────────────────────────────────────────
        resetActiveTab: () =>
          set((s) => {
            const fresh = createNewTab(s.activeTabId);
            return {
              tabs: s.tabs.map((t) => (t.id === s.activeTabId ? fresh : t)),
            };
          }),

        resetAll: () => {
          const fresh = createNewTab('tab-1');
          set({ tabs: [fresh], activeTabId: fresh.id });
        },
      };
    },
    {
      name: 'pos-v2-storage',
      partialize: (state) => ({
        tabs: state.tabs,
        activeTabId: state.activeTabId,
        outOfStockHidden: state.outOfStockHidden,
      }),
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
    return tab.cart.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity - item.discountItem,
      0,
    );
  });

export const useCartTotal = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    const subtotal = tab.cart.reduce(
      (sum, item) => sum + item.unitPrice * item.quantity - item.discountItem,
      0,
    );
    return subtotal - tab.discountTotal + tab.shippingFee;
  });

export const useTotalPaid = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return tab.payments.reduce((sum, p) => sum + p.amount, 0);
  });

export const useCartItemCount = () =>
  usePosStore((s) => {
    const tab = s.tabs.find((t) => t.id === s.activeTabId);
    if (!tab) return 0;
    return tab.cart.reduce((sum, item) => sum + item.quantity, 0);
  });
