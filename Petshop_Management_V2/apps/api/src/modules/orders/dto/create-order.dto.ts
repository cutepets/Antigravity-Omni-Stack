import { IsString, IsNotEmpty, IsOptional, IsNumber, IsArray, ValidateNested, IsEnum } from 'class-validator';
import { Type } from 'class-transformer';
import { OrderStatus, PaymentStatus } from '@prisma/client';

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
  hotelStayId?: string;

  @IsString()
  @IsOptional()
  groomingSessionId?: string;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsNumber()
  quantity!: number;

  @IsNumber()
  unitPrice!: number;

  @IsNumber()
  @IsOptional()
  discountItem?: number;

  @IsString()
  @IsNotEmpty()
  type!: string; // 'product' | 'service' | 'hotel' | 'grooming'
}

export class CreateOrderPaymentDto {
  @IsString()
  @IsNotEmpty()
  method!: string; // 'CASH', 'TRANSFER', 'CARD'

  @IsNumber()
  amount!: number;
}

export class CreateOrderDto {
  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsNotEmpty()
  customerName!: string;

  @IsString()
  @IsOptional()
  staffId?: string; // Tạm thời optional, lấy từ JWT khi thực tế

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
  discount?: number;

  @IsNumber()
  @IsOptional()
  shippingFee?: number;

  @IsString()
  @IsOptional()
  notes?: string;
}
