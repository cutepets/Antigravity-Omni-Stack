import { IsInt, IsNotEmpty, IsOptional, IsDateString } from 'class-validator'
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger'

export class CreateStockCountSessionDto {
  @ApiProperty({ description: 'Chi nhánh thực hiện kiểm kho' })
  @IsNotEmpty()
  branchId!: string

  @ApiProperty({ description: 'Tuần trong năm (1-52)' })
  @IsInt()
  weekNumber!: number

  @ApiProperty({ description: 'Năm' })
  @IsInt()
  year!: number

  @ApiProperty({ description: 'Ngày bắt đầu tuần kiểm' })
  @IsDateString()
  startDate!: string

  @ApiProperty({ description: 'Ngày kết thúc tuần kiểm' })
  @IsDateString()
  endDate!: string

  @ApiPropertyOptional({ description: 'Tổng số sản phẩm cần kiểm' })
  @IsOptional()
  @IsInt()
  totalProducts?: number
}
