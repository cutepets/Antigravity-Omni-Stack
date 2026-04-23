import { Type } from 'class-transformer'
import { IsString, IsOptional, IsEnum, IsNumber, IsDateString, IsArray, ValidateNested } from 'class-validator'
import { GroomingStatus } from '@petshop/database'

export class GroomingExtraServiceDto {
  @IsString()
  @IsOptional()
  pricingRuleId?: string

  @IsString()
  @IsOptional()
  sku?: string | null

  @IsString()
  name!: string

  @IsNumber()
  price!: number

  @IsNumber()
  @IsOptional()
  quantity?: number

  @IsNumber()
  @IsOptional()
  durationMinutes?: number | null
}

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroomingExtraServiceDto)
  @IsOptional()
  extraServices?: GroomingExtraServiceDto[]
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
  contactStatus?: string

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

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GroomingExtraServiceDto)
  @IsOptional()
  extraServices?: GroomingExtraServiceDto[]
}
