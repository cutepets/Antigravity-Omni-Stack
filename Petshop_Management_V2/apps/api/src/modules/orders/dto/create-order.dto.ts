import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsIn, IsDateString, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

// === Grooming Details ===
export class GroomingDetailsDto {
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @IsString()
  @IsOptional()
  performerId?: string;

  @IsDateString()
  @IsOptional()
  startTime?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  serviceItems?: string; // JSON string of service items

  @IsString()
  @IsOptional()
  packageCode?: string;

  @IsString()
  @IsOptional()
  serviceRole?: 'MAIN' | 'EXTRA';

  @IsString()
  @IsOptional()
  pricingRuleId?: string;

  @IsNumber()
  @IsOptional()
  durationMinutes?: number | null;

  @IsNumber()
  @IsOptional()
  weightAtBooking?: number;

  @IsString()
  @IsOptional()
  weightBandId?: string;

  @IsString()
  @IsOptional()
  weightBandLabel?: string;

  @IsNumber()
  @IsOptional()
  pricingPrice?: number;

  @IsOptional()
  pricingSnapshot?: Record<string, unknown>;

  @IsDateString()
  @IsOptional()
  scheduledDate?: string;
}

// === Hotel Details ===
export class HotelDetailsDto {
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @IsDateString()
  @IsNotEmpty()
  checkInDate!: string;

  @IsDateString()
  @IsNotEmpty()
  checkOutDate!: string;

  @IsString()
  @IsOptional()
  roomType?: string;

  @IsString()
  @IsOptional()
  cageId?: string;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  lineType?: string;

  @IsString()
  @IsOptional()
  rateTableId?: string;

  @IsNumber()
  @IsOptional()
  dailyRate?: number;

  @IsNumber()
  @IsOptional()
  depositAmount?: number;

  @IsNumber()
  @IsOptional()
  promotion?: number;

  @IsNumber()
  @IsOptional()
  surcharge?: number;

  @IsString()
  @IsOptional()
  bookingGroupKey?: string;

  @IsNumber()
  @IsOptional()
  chargeLineIndex?: number;

  @IsString()
  @IsOptional()
  chargeLineLabel?: string;

  @IsString()
  @IsOptional()
  chargeDayType?: string;

  @IsNumber()
  @IsOptional()
  chargeQuantityDays?: number;

  @IsNumber()
  @IsOptional()
  chargeUnitPrice?: number;

  @IsNumber()
  @IsOptional()
  chargeSubtotal?: number;

  @IsString()
  @IsOptional()
  chargeWeightBandId?: string;

  @IsString()
  @IsOptional()
  chargeWeightBandLabel?: string;

  @IsString()
  @IsOptional()
  weightBandId?: string;

  @IsString()
  @IsOptional()
  weightBandLabel?: string;

  @IsBoolean()
  @IsOptional()
  checkInNow?: boolean;
}

// === Order Item ===
export class CreateOrderItemDto {
  @IsString()
  @IsOptional()
  productId?: string;

  @IsString()
  @IsOptional()
  productVariantId?: string;

  @IsString()
  @IsOptional()
  serviceId?: string;

  @IsString()
  @IsOptional()
  serviceVariantId?: string;

  @IsString()
  @IsOptional()
  petId?: string;

  @IsString()
  @IsOptional()
  sku?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @IsNumber()
  @Min(0)
  unitPrice!: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountItem?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  vatRate?: number;

  @IsString()
  @IsNotEmpty()
  @IsIn(['product', 'service', 'hotel', 'grooming'])
  type!: string;

  @ValidateNested()
  @Type(() => GroomingDetailsDto)
  @IsOptional()
  groomingDetails?: GroomingDetailsDto;

  @ValidateNested()
  @Type(() => HotelDetailsDto)
  @IsOptional()
  hotelDetails?: HotelDetailsDto;

  @IsBoolean()
  @IsOptional()
  isTemp?: boolean;

  @IsString()
  @IsOptional()
  tempLabel?: string;

  @IsBoolean()
  @IsOptional()
  isPromotionGift?: boolean;

  @IsString()
  @IsOptional()
  promotionRedemptionId?: string;

  @IsOptional()
  promotionSnapshot?: Record<string, unknown>;
}

// === Payment ===
export class CreateOrderPaymentDto {
  @IsString()
  @IsNotEmpty()
  method!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  note?: string;

  @IsString()
  @IsOptional()
  paymentAccountId?: string;

  @IsString()
  @IsOptional()
  paymentAccountLabel?: string;
}

// === Main DTO ===
export class CreateOrderDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderItemDto)
  items!: CreateOrderItemDto[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateOrderPaymentDto)
  @IsOptional()
  payments?: CreateOrderPaymentDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  discount?: number;

  @IsNumber()
  @IsOptional()
  @Min(0)
  manualDiscount?: number;

  @IsString()
  @IsOptional()
  voucherCode?: string;

  @IsString()
  @IsOptional()
  promotionPreviewToken?: string;

  @IsNumber()
  @IsOptional()
  @Min(0)
  shippingFee?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
