import { Type } from 'class-transformer';
import { IsOptional, IsBoolean, IsArray, ValidateNested, IsIn, IsString } from 'class-validator';
import { PaymentEntryDto } from './pay-order.dto.js';

export class CompleteOrderDto {
  @IsBoolean()
  @IsOptional()
  forceComplete?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentEntryDto)
  @IsOptional()
  payments?: PaymentEntryDto[];

  @IsIn(['NONE', 'REFUND', 'KEEP_CREDIT'])
  @IsOptional()
  overpaymentAction?: 'NONE' | 'REFUND' | 'KEEP_CREDIT';

  @IsString()
  @IsOptional()
  refundMethod?: string;

  @IsString()
  @IsOptional()
  settlementNote?: string;
}
