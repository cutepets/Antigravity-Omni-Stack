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

export interface UpdateOrderPayload extends CreateOrderPayload {}

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
    username: string;
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