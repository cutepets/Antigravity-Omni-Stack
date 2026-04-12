import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { HotelLineType, PaymentStatus } from '@petshop/database';

export class CreateCageDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsEnum(HotelLineType)
  @IsOptional()
  type?: HotelLineType;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  @IsOptional()
  position?: number;
}

export class CreateHotelStayDto {
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @IsString()
  @IsOptional()
  petName?: string;

  @IsString()
  @IsOptional()
  customerId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;

  @IsString()
  @IsOptional()
  cageId?: string;

  @IsDateString()
  @IsNotEmpty()
  checkIn!: string;

  @IsDateString()
  @IsOptional()
  checkOut?: string;

  @IsDateString()
  @IsOptional()
  estimatedCheckOut?: string;

  @IsEnum(HotelLineType)
  @IsOptional()
  lineType?: HotelLineType;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsNumber()
  @IsOptional()
  price?: number;

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

  @IsNumber()
  @IsOptional()
  totalPrice?: number;

  @IsString()
  @IsOptional()
  petNotes?: string;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  rateTableId?: string;

  @IsString()
  @IsOptional()
  orderId?: string;
}

export class CreateHotelRateTableDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsNumber()
  year!: number;

  @IsString()
  @IsOptional()
  species?: string;

  @IsNumber()
  @IsOptional()
  minWeight?: number;

  @IsNumber()
  @IsOptional()
  maxWeight?: number;

  @IsEnum(HotelLineType)
  @IsOptional()
  lineType?: HotelLineType;

  @IsNumber()
  ratePerNight!: number;
}
