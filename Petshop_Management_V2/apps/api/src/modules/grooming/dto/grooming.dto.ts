import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator'
import { GroomingStatus } from '@petshop/database'

export class CreateGroomingDto {
  @IsString()
  petId!: string

  @IsString()
  @IsOptional()
  branchId?: string

  @IsString()
  @IsOptional()
  staffId?: string

  @IsOptional()
  staffIds?: string[]

  @IsString()
  @IsOptional()
  serviceId?: string

  @IsString()
  @IsOptional()
  packageCode?: string

  @IsDateString()
  @IsOptional()
  startTime?: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsNumber()
  @IsOptional()
  price?: number

  @IsNumber()
  @IsOptional()
  surcharge?: number
}

export class CalculateSpaPriceDto {
  @IsString()
  petId!: string

  @IsString()
  packageCode!: string

  @IsNumber()
  @IsOptional()
  weight?: number

  @IsString()
  @IsOptional()
  species?: string
}

export class UpdateGroomingDto {
  @IsEnum(GroomingStatus)
  @IsOptional()
  status?: GroomingStatus

  @IsString()
  @IsOptional()
  branchId?: string

  @IsString()
  @IsOptional()
  staffId?: string

  @IsOptional()
  staffIds?: string[]

  @IsString()
  @IsOptional()
  packageCode?: string

  @IsDateString()
  @IsOptional()
  startTime?: string

  @IsDateString()
  @IsOptional()
  endTime?: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsNumber()
  @IsOptional()
  price?: number

  @IsNumber()
  @IsOptional()
  surcharge?: number
}
