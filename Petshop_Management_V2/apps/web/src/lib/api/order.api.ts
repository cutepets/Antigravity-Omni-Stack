import { api } from '../api';

// ─── Order API ─────────────────────────────────────────────────────────────
// Centralized API client for POS order operations
// Maps to OrdersController endpoints in apps/api

export interface CreateOrderPayload {
  customerId?: string;
  customerName: string;
  branchId?: string;
  items: {
    productId?: string;
    productVariantId?: string;
    serviceId?: string;
    serviceVariantId?: string;
    petId?: string;
    description: string;
    quantity: number;
    unitPrice: number;
    discountItem?: number;
    vatRate?: number;
    type: 'product' | 'service' | 'hotel' | 'grooming';
    groomingDetails?: {
      petId: string;
      performerId?: string;
      startTime?: string;
      notes?: string;
      serviceItems?: string;
    };
    hotelDetails?: {
      petId: string;
      checkInDate: string;
      checkOutDate: string;
      roomType?: string;
      cageId?: string;
      notes?: string;
      branchId?: string;
    };
  }[];
  payments?: { method: string; amount: number; note?: string }[];
  discount?: number;
  shippingFee?: number;
  notes?: string;
}

export interface PayOrderPayload {
  payments: { method: string; amount: number; note?: string }[];
}

export interface CompleteOrderPayload {
  forceComplete?: boolean;
}

export interface CancelOrderPayload {
  reason?: string;
}

export interface OrderListParams {
  search?: string;
  paymentStatus?: string;
  status?: string;
  customerId?: string;
  page?: number;
  limit?: number;
  dateFrom?: string;
  dateTo?: string;
}

const MOCK_ORDERS: any[] = [
  {
    id: "ord-test-01",
    orderNumber: "ORD-2024-001",
    paymentStatus: "PENDING",
    paymentMethod: "CASH",
    total: 2500000,
    amountPaid: 0,
    subtotal: 2500000,
    discount: 0,
    shippingFee: 0,
    tax: 0,
    createdAt: new Date(Date.now() - 3600000).toISOString(),
    customer: { id: "cust-01", name: "Nguyễn Văn A", phone: "0901234567" },
    items: [
      { id: "item-1", name: "Thức ăn chó con Royal Canin", quantity: 2, unitPrice: 500000 },
      { id: "item-2", name: "Dịch vụ tắm gội", quantity: 1, unitPrice: 1500000, type: "service" }
    ],
    payments: []
  },
  {
    id: "ord-test-02",
    orderNumber: "ORD-2024-002",
    paymentStatus: "PARTIAL",
    paymentMethod: "TRANSFER",
    total: 800000,
    amountPaid: 400000,
    subtotal: 800000,
    discount: 0,
    shippingFee: 0,
    tax: 0,
    createdAt: new Date(Date.now() - 7200000).toISOString(),
    customer: { id: "cust-02", name: "Trần Thị B", phone: "0987654321" },
    items: [
      { id: "item-3", name: "Balo vận chuyển chó mèo", quantity: 1, unitPrice: 800000 }
    ],
    payments: [
      { method: "TRANSFER", amount: 400000, createdAt: new Date(Date.now() - 7200000).toISOString() }
    ]
  },
  {
    id: "ord-test-03",
    orderNumber: "ORD-2024-003",
    paymentStatus: "COMPLETED",
    paymentMethod: "CARD",
    total: 1200000,
    amountPaid: 1200000,
    subtotal: 1500000,
    discount: 300000,
    shippingFee: 0,
    tax: 0,
    createdAt: new Date(Date.now() - 86400000).toISOString(),
    customer: { id: "cust-03", name: "Lê Minh C", phone: "0912233445" },
    items: [
      { id: "item-4", name: "Khách sạn chó lớn (3 ngày)", quantity: 3, unitPrice: 500000, type: "hotel", petName: "Corgi" }
    ],
    notes: "Khách hẹn đón lúc 5h chiều.",
    payments: [
      { method: "CARD", amount: 1200000, createdAt: new Date(Date.now() - 86400000).toISOString() }
    ]
  }
];

export const orderApi = {
  // ── Catalog ──────────────────────────────────────────────────
  getCatalog: () =>
    api.get('/orders/catalog').then((r) => r.data),

  // ── CRUD ─────────────────────────────────────────────────────
  create: (data: CreateOrderPayload) =>
    api.post('/orders', data).then((r) => r.data),

  pay: (id: string, data: PayOrderPayload) => {
    // Intercept mock payment
    const mock = MOCK_ORDERS.find(o => o.id === id);
    if (mock) {
       const totalPaying = data.payments.reduce((sum, p) => sum + p.amount, 0);
       mock.amountPaid += totalPaying;
       mock.payments.push(...data.payments);
       if (mock.amountPaid >= mock.total) mock.paymentStatus = 'COMPLETED';
       else mock.paymentStatus = 'PARTIAL';
       return Promise.resolve(mock);
    }
    return api.patch(`/orders/${id}/pay`, data).then((r) => r.data);
  },

  complete: (id: string, data?: CompleteOrderPayload) =>
    api.post(`/orders/${id}/complete`, data ?? {}).then((r) => r.data),

  cancel: (id: string, data?: CancelOrderPayload) =>
    api.post(`/orders/${id}/cancel`, data ?? {}).then((r) => r.data),

  removeItem: (orderId: string, itemId: string) =>
    api.delete(`/orders/${orderId}/items/${itemId}`).then((r) => r.data),

  // ── Query ────────────────────────────────────────────────────
  list: (params?: OrderListParams) => {
    return api.get('/orders', { params }).then((r) => {
      if (!r.data?.data || r.data.data.length === 0) {
        return { data: MOCK_ORDERS, total: MOCK_ORDERS.length, totalPages: 1 };
      }
      return r.data;
    }).catch(() => ({ data: MOCK_ORDERS, total: MOCK_ORDERS.length, totalPages: 1 }));
  },

  get: (id: string) => {
    const mock = MOCK_ORDERS.find(o => o.id === id);
    if (mock) return Promise.resolve(mock);
    return api.get(`/orders/${id}`).then((r) => r.data).catch(() => MOCK_ORDERS[0]);
  },
};
