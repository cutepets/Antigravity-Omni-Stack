import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelRateTableDto, CreateHotelStayDto, CreateCageDto } from './create-hotel.dto.js';
import { IsDateString, IsEnum, IsNumber, IsOptional, IsString } from 'class-validator';
import { HotelLineType, HotelStatus, PaymentStatus } from '@petshop/database';

export class UpdateHotelStayDto extends PartialType(CreateHotelStayDto) {
  @IsEnum(HotelStatus)
  @IsOptional()
  status?: HotelStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;
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
}
