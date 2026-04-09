import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CreateStaffDto, StaffService, UpdateStaffDto } from './staff.service.js'

@ApiTags('Staff')
@Controller('staff')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class StaffController {
  constructor(private readonly staffService: StaffService) {}

  @Get()
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy danh sách nhân viên' })
  findAll() {
    return this.staffService.findAll()
  }

  @Get(':id')
  @Permissions('staff.read')
  @ApiOperation({ summary: 'Lấy chi tiết nhân viên' })
  findById(@Param('id') id: string) {
    return this.staffService.findById(id)
  }

  @Post()
  @Permissions('staff.create')
  @ApiOperation({ summary: 'Tạo nhân viên mới' })
  create(@Body() dto: CreateStaffDto) {
    return this.staffService.create(dto)
  }

  @Patch(':id')
  @Permissions('staff.update')
  @ApiOperation({ summary: 'Cập nhật thông tin nhân viên' })
  update(@Param('id') id: string, @Body() dto: UpdateStaffDto) {
    return this.staffService.update(id, dto)
  }

  @Delete(':id')
  @Permissions('staff.deactivate')
  @ApiOperation({ summary: 'Đình chỉ nhân viên' })
  deactivate(@Param('id') id: string) {
    return this.staffService.deactivate(id)
  }
}
