import { Controller, Get, Post, Patch, Delete, Body, Param, UseGuards } from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger'
import { StaffService, CreateStaffDto, UpdateStaffDto } from './staff.service.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { Permissions } from '../../common/decorators/permissions.decorator.js'

@ApiTags('Staff')
@Controller('staff')
@UseGuards(JwtGuard, PermissionsGuard)
@Permissions('MANAGE_USERS') // Global policy for /staff routes
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @ApiOperation({ summary: 'Lấy danh sách nhân viên' })
  findAll() {
    return this.staffService.findAll()
  }

  @Get(':id')
  @ApiOperation({ summary: 'Lấy chi tiết nhân viên' })
  findById(@Param('id') id: string) {
    return this.staffService.findById(id)
  }

  @Post()
  @ApiOperation({ summary: 'Tạo nhân viên mới' })
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto)
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Cập nhật thông tin nhân viên' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Đình chỉ nhân viên (Soft Delete)' })
  @Permissions('MANAGE_USERS') // ADMINs automatically have all permissions by Guard bypass
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id)
  }
}
