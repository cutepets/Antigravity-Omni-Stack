import { IsArray, IsBoolean, IsDateString, IsIn, IsNumber, IsObject, IsOptional, IsString, Min } from 'class-validator'

export class PromotionCartItemDto {
  @IsString()
  @IsOptional()
  lineId?: string

  @IsString()
  @IsOptional()
  productId?: string

  @IsString()
  @IsOptional()
  productVariantId?: string

  @IsString()
  @IsOptional()
  serviceId?: string

  @IsString()
  @IsOptional()
  serviceVariantId?: string

  @IsString()
  @IsOptional()
  category?: string

  @IsString()
  type!: string

  @IsNumber()
  @Min(0)
  quantity!: number

  @IsNumber()
  @Min(0)
  unitPrice!: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  discountItem?: number
}

export class PromotionPreviewDto {
  @IsString()
  @IsOptional()
  branchId?: string

  @IsString()
  @IsOptional()
  customerId?: string

  @IsString()
  @IsOptional()
  voucherCode?: string

  @IsNumber()
  @IsOptional()
  @Min(0)
  manualDiscount?: number

  @IsArray()
  items!: PromotionCartItemDto[]

  @IsArray()
  @IsOptional()
  petIds?: string[]
}

export class CreatePromotionDto {
  @IsString()
  code!: string

  @IsString()
  name!: string

  @IsString()
  @IsIn(['DISCOUNT', 'BUY_X_GET_Y', 'VOUCHER', 'BIRTHDAY', 'AUTO_VOUCHER'])
  type!: string

  @IsString()
  @IsOptional()
  description?: string

  @IsString()
  @IsOptional()
  status?: string

  @IsNumber()
  @IsOptional()
  priority?: number

  @IsDateString()
  @IsOptional()
  startsAt?: string

  @IsDateString()
  @IsOptional()
  endsAt?: string

  @IsArray()
  @IsOptional()
  branchIds?: string[]

  @IsArray()
  @IsOptional()
  customerGroupIds?: string[]

  @IsObject()
  @IsOptional()
  conditions?: Record<string, unknown>

  @IsObject()
  reward!: Record<string, unknown>

  @IsArray()
  @IsOptional()
  schedules?: Array<{
    months?: number[] | null
    monthDays?: number[] | null
    weekdays?: number[] | null
    timeRanges?: Array<{ start: string; end: string }> | null
  }>

  @IsObject()
  @IsOptional()
  voucherBatch?: {
    name: string
    prefix?: string
    quantity: number
    usageLimitPerCode?: number
    expiresAt?: string
    customerId?: string
  }

  @IsBoolean()
  @IsOptional()
  allowStacking?: boolean

  @IsNumber()
  @IsOptional()
  @Min(1)
  usageLimit?: number

  @IsNumber()
  @IsOptional()
  @Min(0)
  budgetLimit?: number
}

export class UpdatePromotionDto extends CreatePromotionDto {
  @IsString()
  @IsOptional()
  declare code: string

  @IsString()
  @IsOptional()
  declare name: string

  @IsString()
  @IsOptional()
  declare type: string

  @IsObject()
  @IsOptional()
  declare reward: Record<string, unknown>

  @IsObject()
  @IsOptional()
  declare voucherBatch?: CreatePromotionDto['voucherBatch']
}

export class GenerateVouchersDto {
  @IsString()
  promotionId!: string

  @IsString()
  name!: string

  @IsString()
  @IsOptional()
  prefix?: string

  @IsNumber()
  @Min(1)
  quantity!: number

  @IsNumber()
  @IsOptional()
  @Min(1)
  usageLimitPerCode?: number

  @IsString()
  @IsOptional()
  customerId?: string

  @IsDateString()
  @IsOptional()
  expiresAt?: string
}
