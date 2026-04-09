import { KNOWN_PERMISSION_CODES } from '@petshop/auth'
import { IsString, IsNotEmpty, IsOptional, IsArray, ArrayUnique, IsIn } from 'class-validator'
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
  @ArrayUnique()
  @IsIn(KNOWN_PERMISSION_CODES, { each: true, message: 'permissions chứa mã quyền không hợp lệ' })
  @IsOptional()
  permissions?: string[]
}
