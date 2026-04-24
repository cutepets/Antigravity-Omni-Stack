import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsOptional, IsString, ValidateNested } from 'class-validator'
import { Type } from 'class-transformer'

export type PricingServiceType = 'GROOMING' | 'HOTEL'
export type PricingDayType = 'REGULAR' | 'HOLIDAY'

export class PricingQueryDto {
  @IsIn(['GROOMING', 'HOTEL'])
  @IsOptional()
  serviceType?: PricingServiceType

  @IsString()
  @IsOptional()
  species?: string

  @IsNumber()
  @IsOptional()
  year?: number

  @IsIn(['REGULAR', 'HOLIDAY'])
  @IsOptional()
  dayType?: PricingDayType
}

export class UpsertWeightBandDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsIn(['GROOMING', 'HOTEL'])
  serviceType!: PricingServiceType

  @IsString()
  @IsOptional()
  species?: string | null

  @IsString()
  label!: string

  @IsNumber()
  minWeight!: number

  @IsNumber()
  @IsOptional()
  maxWeight?: number | null

  @IsNumber()
  @IsOptional()
  sortOrder?: number

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

export class CreatePresetWeightBandsDto {
  @IsIn(['GROOMING', 'HOTEL'])
  serviceType!: PricingServiceType

  @IsString()
  @IsOptional()
  species?: string
}

export class SpaRuleInputDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  @IsOptional()
  sku?: string | null

  @IsString()
  @IsOptional()
  species?: string | null

  @IsString()
  packageCode!: string

  @IsString()
  @IsOptional()
  label?: string | null

  @IsString()
  @IsOptional()
  weightBandId?: string | null

  @IsNumber()
  @IsOptional()
  minWeight?: number | null

  @IsNumber()
  @IsOptional()
  maxWeight?: number | null

  @IsNumber()
  price!: number

  @IsNumber()
  @IsOptional()
  durationMinutes?: number | null

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

export class BulkUpsertSpaRulesDto {
  @IsString()
  @IsOptional()
  species?: string | null

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SpaRuleInputDto)
  rules!: SpaRuleInputDto[]
}

export class HotelRuleInputDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  @IsOptional()
  sku?: string | null

  @IsNumber()
  year!: number

  @IsString()
  @IsOptional()
  species?: string | null

  @IsString()
  weightBandId!: string

  @IsIn(['REGULAR', 'HOLIDAY'])
  dayType!: PricingDayType

  @IsNumber()
  fullDayPrice!: number

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

export class BulkUpsertHotelRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelRuleInputDto)
  rules!: HotelRuleInputDto[]
}

export class HotelDaycareRuleInputDto {
  @IsString()
  @IsOptional()
  id?: string

  @IsString()
  @IsOptional()
  sku?: string | null

  @IsString()
  @IsOptional()
  species?: string | null

  @IsString()
  weightBandId!: string

  @IsNumber()
  packageDays!: number

  @IsNumber()
  price!: number

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

export class BulkUpsertHotelDaycareRulesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelDaycareRuleInputDto)
  rules!: HotelDaycareRuleInputDto[]
}

export class HotelExtraServiceInputDto {
  @IsString()
  @IsOptional()
  sku?: string | null

  @IsString()
  name!: string

  @IsNumber()
  @IsOptional()
  minWeight?: number | null

  @IsNumber()
  @IsOptional()
  maxWeight?: number | null

  @IsNumber()
  price!: number
}

export class BulkUpsertHotelExtraServicesDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => HotelExtraServiceInputDto)
  services!: HotelExtraServiceInputDto[]
}

export class CreateHolidayDto {
  @IsDateString()
  @IsOptional()
  date?: string

  @IsDateString()
  @IsOptional()
  startDate?: string

  @IsDateString()
  @IsOptional()
  endDate?: string

  @IsString()
  name!: string

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}

export class UpdateHolidayDto {
  @IsDateString()
  @IsOptional()
  date?: string

  @IsDateString()
  @IsOptional()
  startDate?: string

  @IsDateString()
  @IsOptional()
  endDate?: string

  @IsString()
  @IsOptional()
  name?: string

  @IsBoolean()
  @IsOptional()
  isRecurring?: boolean

  @IsBoolean()
  @IsOptional()
  isActive?: boolean
}
