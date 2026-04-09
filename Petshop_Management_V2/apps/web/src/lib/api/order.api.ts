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
    };
  }[];
  payments?: { method: string; amount: number; note?: string }[];
  discount?: number;
  shippingFee?: number;
  notes?: string;
}

export interface UpdateOrderPayload extends CreateOrderPayload {}

export interface PayOrderPayload {
  payments: { method: string; amount: number; note?: string }[];
}

export interface CompleteOrderPayload {
  forceComplete?: boolean;
  payments?: { method: string; amount: number; note?: string }[];
  overpaymentAction?: 'NONE' | 'REFUND' | 'KEEP_CREDIT';
  refundMethod?: string;
  settlementNote?: string;
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

  cancel: (id: string, data?: CancelOrderPayload) =>
    api.post(`/orders/${id}/cancel`, data ?? {}).then((r) => r.data),

  removeItem: (orderId: string, itemId: string) =>
    api.delete(`/orders/${orderId}/items/${itemId}`).then((r) => r.data),

  list: (params?: OrderListParams) =>
    api.get('/orders', { params }).then((r) => r.data),

  get: (id: string) =>
    api.get(`/orders/${id}`).then((r) => r.data),
};
