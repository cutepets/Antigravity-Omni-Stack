import { api } from '../api';

export interface CreateOrderPayload {
  customerId?: string;
  customerName: string;
  branchId?: string;
  items: {
    id?: string;
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
      packageCode?: string;
      weightAtBooking?: number;
      weightBandId?: string;
      weightBandLabel?: string;
      pricingPrice?: number;
      pricingSnapshot?: Record<string, unknown>;
    };
    hotelDetails?: {
      petId: string;
      checkInDate: string;
      checkOutDate: string;
      roomType?: string;
      cageId?: string;
      notes?: string;
      branchId?: string;
      lineType?: string;
      rateTableId?: string;
      dailyRate?: number;
      depositAmount?: number;
      promotion?: number;
      surcharge?: number;
      bookingGroupKey?: string;
      chargeLineIndex?: number;
      chargeLineLabel?: string;
      chargeDayType?: string;
      chargeQuantityDays?: number;
      chargeUnitPrice?: number;
      chargeSubtotal?: number;
      chargeWeightBandId?: string;
      chargeWeightBandLabel?: string;
    };
  }[];
  payments?: { method: string; amount: number; note?: string; paymentAccountId?: string; paymentAccountLabel?: string }[];
  discount?: number;
  shippingFee?: number;
  notes?: string;
}

export interface UpdateOrderPayload extends CreateOrderPayload { }

export interface PayOrderPayload {
  payments: { method: string; amount: number; note?: string; paymentAccountId?: string; paymentAccountLabel?: string }[];
}

export interface CompleteOrderPayload {
  forceComplete?: boolean;
  payments?: { method: string; amount: number; note?: string; paymentAccountId?: string; paymentAccountLabel?: string }[];
  overpaymentAction?: 'NONE' | 'REFUND' | 'KEEP_CREDIT';
  refundMethod?: string;
  refundPaymentAccountId?: string;
  refundPaymentAccountLabel?: string;
  settlementNote?: string;
}

export interface CancelOrderPayload {
  reason?: string;
}

export interface ApproveOrderPayload {
  note?: string;
}

export interface ExportStockPayload {
  note?: string;
}

export interface SettleOrderPayload {
  note?: string;
  additionalPayments?: PayOrderPayload['payments'];
}

export interface OrderTimelineEntry {
  id: string;
  orderId: string;
  action: string;
  fromStatus?: string | null;
  toStatus?: string | null;
  note?: string | null;
  performedBy: string;
  performedByUser: {
    id: string;
    fullName: string;
    staffCode: string;
  };
  metadata?: Record<string, any> | null;
  createdAt: string;
}

export interface CreatePaymentIntentPayload {
  paymentMethodId: string;
  amount?: number;
}

export interface OrderPaymentIntent {
  id: string;
  code: string;
  orderId?: string | null;
  paymentMethodId: string;
  amount: number;
  currency: string;
  status: 'PENDING' | 'PAID' | 'EXPIRED';
  provider?: 'VIETQR' | null;
  transferContent: string;
  qrUrl?: string | null;
  qrPayload?: string | null;
  expiresAt?: string | null;
  paidAt?: string | null;
  createdAt: string;
  updatedAt: string;
  paymentMethod: {
    id: string;
    name: string;
    type: string;
    colorKey?: string | null;
    bankName?: string | null;
    accountNumber?: string | null;
    accountHolder?: string | null;
    qrTemplate?: string | null;
  };
  order?: {
    id: string;
    orderNumber: string;
    total: number;
    paidAmount: number;
    remainingAmount: number;
    customerName?: string | null;
  } | null;
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

export const orderApi = {
  getCatalog: () => api.get('/orders/catalog').then((r) => r.data),

  create: (data: CreateOrderPayload) =>
    api.post('/orders', data).then((r) => r.data),

  update: (id: string, data: UpdateOrderPayload) =>
    api.put(`/orders/${id}`, data).then((r) => r.data),

  pay: (id: string, data: PayOrderPayload) =>
    api.patch(`/orders/${id}/pay`, data).then((r) => r.data),

  complete: (id: string, data?: CompleteOrderPayload) =>
    api.post(`/orders/${id}/complete`, data ?? {}).then((r) => r.data),

  listPaymentIntents: (id: string): Promise<OrderPaymentIntent[]> =>
    api.get(`/orders/${id}/payment-intents`).then((r) => r.data),

  createPaymentIntent: (id: string, data: CreatePaymentIntentPayload): Promise<OrderPaymentIntent> =>
    api.post(`/orders/${id}/payment-intents`, data).then((r) => r.data),

  cancel: (id: string, data?: CancelOrderPayload) =>
    api.post(`/orders/${id}/cancel`, data ?? {}).then((r) => r.data),

  removeItem: (orderId: string, itemId: string) =>
    api.delete(`/orders/${orderId}/items/${itemId}`).then((r) => r.data),

  list: (params?: OrderListParams) =>
    api.get('/orders', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/orders/${id}`).then((r) => r.data),

  approve: (id: string, data?: ApproveOrderPayload) =>
    api.post(`/orders/${id}/approve`, data ?? {}).then((r) => r.data),

  exportStock: (id: string, data?: ExportStockPayload) =>
    api.post(`/orders/${id}/export-stock`, data ?? {}).then((r) => r.data),

  settle: (id: string, data?: SettleOrderPayload) =>
    api.post(`/orders/${id}/settle`, data ?? {}).then((r) => r.data),

  getTimeline: (id: string): Promise<OrderTimelineEntry[]> =>
    api.get(`/orders/${id}/timeline`).then((r) => r.data),
};
