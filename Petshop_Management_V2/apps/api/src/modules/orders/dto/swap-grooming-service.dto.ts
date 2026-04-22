import { IsOptional, IsString } from 'class-validator';

export class SwapGroomingServiceDto {
  @IsString()
  targetPricingRuleId!: string;

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  refundPaymentAccountId?: string;

  @IsString()
  @IsOptional()
  refundPaymentAccountLabel?: string;

  @IsString()
  @IsOptional()
  note?: string;
}
