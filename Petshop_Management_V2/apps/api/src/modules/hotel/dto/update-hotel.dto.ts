import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelRateTableDto, CreateHotelStayDto, CreateCageDto, HotelStayAdjustmentDto } from './create-hotel.dto.js';
import { Type } from 'class-transformer';
import { IsArray, IsDateString, IsEnum, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator';
import { HotelLineType, HotelStatus, PaymentStatus } from '@petshop/database';

export class UpdateHotelStayDto extends PartialType(CreateHotelStayDto) {
  @IsEnum(HotelStatus)
  @IsOptional()
  status?: HotelStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsDateString()
  @IsOptional()
  checkedInAt?: string | null;

  @IsDateString()
  @IsOptional()
  checkOutActual?: string | null;
}

export class UpdateCageDto extends PartialType(CreateCageDto) {}

export class UpdateHotelRateTableDto extends PartialType(CreateHotelRateTableDto) {}

export class CheckoutHotelStayDto {
  @IsDateString()
  @IsOptional()
  checkOutActual?: string;

  @IsNumber()
  @IsOptional()
  dailyRate?: number;

  @IsNumber()
  @IsOptional()
  surcharge?: number;

  @IsNumber()
  @IsOptional()
  promotion?: number;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;

  @IsString()
  @IsOptional()
  notes?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelStayAdjustmentDto)
  @IsOptional()
  adjustments?: HotelStayAdjustmentDto[];
}

export class CalculateHotelPriceDto {
  @IsDateString()
  checkIn!: string;

  @IsDateString()
  checkOut!: string;

  @IsString()
  species!: string;

  @IsNumber()
  weight!: number;

  @IsEnum(HotelLineType)
  @IsOptional()
  lineType?: HotelLineType;

  @IsString()
  @IsOptional()
  rateTableId?: string;

  @IsString()
  @IsOptional()
  branchId?: string;
}
