import { IsString, IsNotEmpty, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator';
import { HotelStatus, HotelLineType, PaymentStatus } from '@prisma/client';

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
}

export class CreateHotelStayDto {
  @IsString()
  @IsNotEmpty()
  petId!: string;

  @IsString()
  @IsNotEmpty()
  petName!: string;

  @IsString()
  @IsOptional()
  customerId?: string;

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
}
