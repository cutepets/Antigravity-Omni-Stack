import { IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class StartShiftSessionDto {
  @ApiPropertyOptional({ description: 'Ghi chú cho ca kiểm' })
  @IsOptional()
  @IsString()
  notes?: string
}
