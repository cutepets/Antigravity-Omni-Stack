import { IsString, IsNotEmpty, IsOptional, IsArray } from 'class-validator'
import { ApiProperty } from '@nestjs/swagger'

export class CreateRoleDto {
  @ApiProperty({ description: 'Mã vai trò (phải là duy nhất, form: ADMIN, SUPER_ADMIN, vv)', example: 'MANAGER' })
  @IsString()
  @IsNotEmpty()
  code!: string

  @ApiProperty({ description: 'Tên vai trò (để hiển thị)', example: 'Quản lý chung' })
  @IsString()
  @IsNotEmpty()
  name!: string

  @ApiProperty({ description: 'Mô tả', required: false })
  @IsString()
  @IsOptional()
  description?: string

  @ApiProperty({ description: 'Mảng các quyền', example: ['VIEW_DASHBOARD', 'MANAGE_USERS'] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  permissions?: string[]
}
