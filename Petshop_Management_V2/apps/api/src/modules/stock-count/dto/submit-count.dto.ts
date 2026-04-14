import { IsInt, IsOptional, IsString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class SubmitCountItemDto {
  @ApiProperty({
    description:
      'So chenh lech so voi he thong. Khop nhap 0, thieu nhap so am, thua nhap so duong',
  })
  @IsInt()
  variance!: number

  @ApiPropertyOptional({ description: 'Ghi chu cho item nay' })
  @IsOptional()
  @IsString()
  notes?: string
}
