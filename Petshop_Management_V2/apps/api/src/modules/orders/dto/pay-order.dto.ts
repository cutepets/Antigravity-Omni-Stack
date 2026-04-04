import { IsString, IsOptional, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class PaymentEntryDto {
  @IsString()
  method!: string;

  @IsNumber()
  @Min(0.01)
  amount!: number;

  @IsString()
  @IsOptional()
  note?: string;
}

export class PayOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PaymentEntryDto)
  payments!: PaymentEntryDto[];
}
