import { IsString, IsNotEmpty, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin hoặc 0901234567', description: 'Tên đăng nhập hoặc SĐT' })
  @IsString()
  @IsNotEmpty()
  username!: string

  @ApiProperty({ example: 'password123', description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string
}
