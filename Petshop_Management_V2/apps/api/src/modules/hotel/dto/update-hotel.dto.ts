import { PartialType } from '@nestjs/mapped-types';
import { CreateHotelStayDto, CreateCageDto } from './create-hotel.dto.js';
import { IsEnum, IsOptional } from 'class-validator';
import { HotelStatus, PaymentStatus } from '@prisma/client';

export class UpdateHotelStayDto extends PartialType(CreateHotelStayDto) {
  @IsEnum(HotelStatus)
  @IsOptional()
  status?: HotelStatus;

  @IsEnum(PaymentStatus)
  @IsOptional()
  paymentStatus?: PaymentStatus;
}

export class UpdateCageDto extends PartialType(CreateCageDto) {}
