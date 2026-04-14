import { IsDateString, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class ClaimRandomShiftDto {
  @ApiProperty({ description: 'Ngay muon nhan ca kiem trong tuan dang mo' })
  @IsDateString()
  countDate!: string

  @ApiPropertyOptional({ description: 'Ghi chu khi nhan ca kiem' })
  @IsOptional()
  @IsString()
  notes?: string
}
