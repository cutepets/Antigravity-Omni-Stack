import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { RolesService } from './roles.service.js'
import { CreateRoleDto } from './dto/create-role.dto.js'
import { UpdateRoleDto } from './dto/update-role.dto.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { Permissions } from '../../common/decorators/permissions.decorator.js'

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions('MANAGE_ROLES')
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy toàn bộ vai trò' })
  @Permissions('MANAGE_ROLES', 'MANAGE_USERS')
  findAll() {
    return this.rolesService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết vai trò' })
  findById(@Param('id') id: string) {
    return this.rolesService.findById(id)
  }

  @Post()
  @ApiOperation({ summary: 'Tạo vai trò' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật vai trò' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa vai trò' })
  delete(@Param('id') id: string) {
    return this.rolesService.delete(id)
  }
}
