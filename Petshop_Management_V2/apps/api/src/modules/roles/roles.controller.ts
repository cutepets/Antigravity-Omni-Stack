import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CreateRoleDto } from './dto/create-role.dto.js'
import { UpdateRoleDto } from './dto/update-role.dto.js'
import { RolesService } from './roles.service.js'

@ApiTags('Roles')
@Controller('roles')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Get()
  @Permissions('role.read', 'staff.read')
  @ApiOperation({ summary: 'Lấy toàn bộ vai trò' })
  findAll() {
    return this.rolesService.findAll()
  }

  @Get('permission-catalog')
  @Permissions('role.read', 'staff.read')
  @ApiOperation({ summary: 'Lấy catalog quyền chi tiết' })
  getPermissionCatalog() {
    return this.rolesService.getPermissionCatalog()
  }

  @Get(':id')
  @Permissions('role.read')
  @ApiOperation({ summary: 'Lấy chi tiết vai trò' })
  findById(@Param('id') id: string) {
    return this.rolesService.findById(id)
  }

  @Post()
  @Permissions('role.create')
  @ApiOperation({ summary: 'Tạo vai trò' })
  create(@Body() dto: CreateRoleDto) {
    return this.rolesService.create(dto)
  }

  @Put(':id')
  @Permissions('role.update')
  @ApiOperation({ summary: 'Cập nhật vai trò' })
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto) {
    return this.rolesService.update(id, dto)
  }

  @Delete(':id')
  @Permissions('role.delete')
  @ApiOperation({ summary: 'Xóa vai trò' })
  delete(@Param('id') id: string) {
    return this.rolesService.delete(id)
  }
}
