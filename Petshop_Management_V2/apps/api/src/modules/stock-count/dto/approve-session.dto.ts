import { IsOptional, IsString } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class ApproveSessionDto {
  @ApiPropertyOptional({ description: 'Lý do từ chối (nếu reject)' })
  @IsOptional()
  @IsString()
  rejectionReason?: string
}
