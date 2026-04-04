import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, Min, IsIn, IsDateString } from 'class-validator';
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
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  @Min(1)
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
  shippingFee?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
