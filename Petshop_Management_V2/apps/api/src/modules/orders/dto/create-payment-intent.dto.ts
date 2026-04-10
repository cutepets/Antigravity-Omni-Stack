import { Type } from 'class-transformer'
import { IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class CreatePaymentIntentDto {
  @IsString()
  paymentMethodId!: string

  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @IsOptional()
  amount?: number
}

