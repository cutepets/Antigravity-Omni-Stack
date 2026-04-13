import { IsInt, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class AssignShiftsDto {
  @ApiProperty({ description: 'Danh sách ID sản phẩm cần phân ca' })
  @IsString({ each: true })
  productIds!: string[]

  @ApiPropertyOptional({ description: 'Phân loại sản phẩm' })
  @IsOptional()
  @IsString()
  category?: string
}
