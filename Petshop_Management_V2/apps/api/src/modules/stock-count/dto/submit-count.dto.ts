import { IsInt, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubmitCountItemDto {
  @ApiProperty({ description: 'Số lượng thực tế kiểm được' })
  @IsInt()
  countedQuantity!: number

  @ApiPropertyOptional({ description: 'Ghi chú cho item này' })
  @IsOptional()
  @IsString()
  notes?: string
}
