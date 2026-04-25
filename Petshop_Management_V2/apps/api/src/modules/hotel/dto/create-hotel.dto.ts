import { Type } from 'class-transformer';
import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString, IsArray, ValidateNested } from 'class-validator';
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

export class HotelStayAdjustmentDto {
  @IsString()
  @IsOptional()
  id?: string;

  @IsString()
  @IsOptional()
  type?: string;

  @IsString()
  @IsNotEmpty()
  label!: string;

  @IsNumber()
  amount!: number;

  @IsString()
  @IsOptional()
  note?: string;
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
  weightBandId?: string;

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

  @IsString()
  @IsOptional()
  accessories?: string;

  @IsNumber()
  @IsOptional()
  slotIndex?: number;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelStayAdjustmentDto)
  @IsOptional()
  adjustments?: HotelStayAdjustmentDto[];
}

export class CreateHotelStayHealthLogDto {
  @IsString()
  @IsNotEmpty()
  content!: string;

  @IsString()
  @IsOptional()
  condition?: string;

  @IsNumber()
  @IsOptional()
  temperature?: number;

  @IsNumber()
  @IsOptional()
  weight?: number;

  @IsString()
  @IsOptional()
  appetite?: string;

  @IsString()
  @IsOptional()
  stool?: string;
}

export class CreateHotelStayNoteDto {
  @IsString()
  @IsNotEmpty()
  content!: string;
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
