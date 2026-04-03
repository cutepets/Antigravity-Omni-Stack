import { IsString, IsNotEmpty, MinLength } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class LoginDto {
  @ApiProperty({ example: 'admin', description: 'Tên đăng nhập' })
  @IsString()
  @IsNotEmpty()
  username!: string

  @ApiProperty({ example: 'password123', description: 'Mật khẩu' })
  @IsString()
  @IsNotEmpty()
  @MinLength(6)
  password!: string
}
