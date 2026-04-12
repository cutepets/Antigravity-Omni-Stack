import type { PaymentEntry } from './order.types.js';
export interface CartItem {
    id: string;
    orderItemId?: string;
    productId?: string;
    productVariantId?: string;
    serviceId?: string;
    serviceVariantId?: string;
    description: string;
    sku?: string;
    barcode?: string;
    weightBandLabel?: string;
    quantity: number;
    unitPrice: number;
    discountItem: number;
    vatRate: number;
    petId?: string;
    petName?: string;
    petImage?: string;
    type: 'product' | 'service';
    serviceType?: string;
    unit: string;
    baseUnitPrice?: number;
    image?: string;
    variantName?: string;
    groomingDetails?: {
        petId: string;
        startTime?: string;
        notes?: string;
    };
    hotelDetails?: {
        petId: string;
        checkIn: string;
        checkOut: string;
        stayId?: string;
        lineType: 'REGULAR' | 'HOLIDAY';
        tableName?: string;
    };
    itemNotes?: string;
    isTempItem?: boolean;
}
export interface OrderTab {
    id: string;
    title: string;
    customerId?: string;
    customerName: string;
    productSearch: string;
    cart: CartItem[];
    payments: PaymentEntry[];
    manualDiscountTotal?: number;
    roundingDiscountTotal?: number;
    discountTotal: number;
    shippingFee: number;
    notes: string;
    activePetIds: string[];
    existingOrderId?: string;
    existingOrderNumber?: string;
    existingPaymentStatus?: string;
    existingAmountPaid?: number;
    branchId?: string;
}
//# sourceMappingURL=pos.types.d.ts.map
