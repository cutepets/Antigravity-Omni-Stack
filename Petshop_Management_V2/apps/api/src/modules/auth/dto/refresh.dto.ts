import { IsString, IsNotEmpty, IsOptional } from 'class-validator'
import { ApiPropertyOptional } from '@nestjs/swagger'

export class RefreshTokenDto {
  @ApiPropertyOptional({ description: 'Refresh token' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string
}
