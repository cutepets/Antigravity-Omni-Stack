import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentEntryDto } from './pay-order.dto';

export class SettleOrderDto {
  @ApiPropertyOptional({ description: 'Ghi chú khi quyết toán' })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'Thanh toán bổ sung (nếu còn nợ)' })
  @IsOptional()
  additionalPayments?: PaymentEntryDto[];
}
