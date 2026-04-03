import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface PosItem {
  id: string; // product/service id
  name: string;
  price: number;
  type: 'product' | 'service' | 'hotel' | 'grooming';
  quantity: number;
  discountItem: number;
}

interface PosState {
  items: PosItem[];
  customerId: string | null;
  customerName: string;
  notes: string;
  discount: number;
  shippingFee: number;
  
  // Actions
  addItem: (item: Omit<PosItem, 'quantity' | 'discountItem'>) => void;
  updateQuantity: (id: string, quantity: number) => void;
  updateDiscountItem: (id: string, discount: number) => void;
  removeItem: (id: string) => void;
  setCustomer: (id: string | null, name: string) => void;
  setNotes: (notes: string) => void;
  setDiscount: (discount: number) => void;
  setShipping: (fee: number) => void;
  clearCart: () => void;
}

export const usePosStore = create<PosState>()(
  persist(
    (set) => ({
      items: [],
      customerId: null,
      customerName: 'Khách lẻ',
      notes: '',
      discount: 0,
      shippingFee: 0,

      addItem: (item) => set((state) => {
        const existing = state.items.find(i => i.id === item.id);
        if (existing) {
          return {
            items: state.items.map(i => 
              i.id === item.id 
                ? { ...i, quantity: i.quantity + 1 }
                : i
            )
          };
        }
        return {
          items: [...state.items, { ...item, quantity: 1, discountItem: 0 }]
        };
      }),

      updateQuantity: (id, quantity) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, quantity } : i)
      })),

      updateDiscountItem: (id, discountItem) => set((state) => ({
        items: state.items.map(i => i.id === id ? { ...i, discountItem } : i)
      })),

      removeItem: (id) => set((state) => ({
        items: state.items.filter(i => i.id !== id)
      })),

      setCustomer: (id, name) => set({ customerId: id, customerName: name }),
      
      setNotes: (notes) => set({ notes }),
      
      setDiscount: (discount) => set({ discount }),
      
      setShipping: (shippingFee) => set({ shippingFee }),

      clearCart: () => set({
        items: [],
        customerId: null,
        customerName: 'Khách lẻ',
        notes: '',
        discount: 0,
        shippingFee: 0
      })
    }),
    {
      name: 'pos-storage',
    }
  )
);
