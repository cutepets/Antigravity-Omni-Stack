import { IsOptional, IsString } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class ApproveOrderDto {
  @ApiPropertyOptional({ description: 'Ghi chú khi duyệt đơn' })
  @IsOptional()
  @IsString()
  note?: string;
}

export class ExportStockDto {
  @ApiPropertyOptional({ description: 'Ghi chú khi xuất kho' })
  @IsOptional()
  @IsString()
  note?: string;
}
