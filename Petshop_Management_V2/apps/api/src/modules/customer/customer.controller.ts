import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { SuperAdminGuard } from '../../common/security/super-admin.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  AdjustCustomerPointsDto,
  CreateCustomerDto,
  BulkUpdateCustomerDto,
  CustomerService,
  FindCustomersDto,
  UpdateCustomerDto,
} from './customer.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @Permissions('customer.read.all', 'customer.read.assigned')
  @ApiOperation({ summary: 'Danh sách khách hàng' })
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'groupId', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  @ApiQuery({ name: 'minSpent', required: false })
  @ApiQuery({ name: 'maxSpent', required: false })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'dateFrom', required: false })
  @ApiQuery({ name: 'dateTo', required: false })
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAll(@Query() query: FindCustomersDto, @Req() req: AuthenticatedRequest) {
    return this.customerService.findAll(query, req.user, query.branchId ?? getRequestedBranchId(req))
  }

  @Post('bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('customer.delete')
  @ApiOperation({ summary: 'Xóa hàng loạt khách hàng (chỉ SUPER_ADMIN)' })
  bulkRemove(@Body() body: { ids?: string[] }, @Req() req: AuthenticatedRequest) {
    return this.customerService.bulkRemove(body.ids, req.user)
  }

  @Patch('bulk-update')
  @Permissions('customer.update')
  @ApiOperation({ summary: 'Cập nhật hàng loạt khách hàng' })
  bulkUpdate(@Body() body: { ids?: string[]; updates?: BulkUpdateCustomerDto }, @Req() req: AuthenticatedRequest) {
    return this.customerService.bulkUpdate(body.ids, body.updates ?? {}, req.user)
  }

  @Get(':id/points-history')
  @Permissions('customer.read.all', 'customer.read.assigned')
  @ApiOperation({ summary: 'Lịch sử điểm khách hàng' })
  getPointHistory(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.customerService.getPointHistory(id, req.user)
  }

  @Post(':id/points-adjustments')
  @Permissions('customer.update')
  @ApiOperation({ summary: 'Điều chỉnh điểm khách hàng' })
  adjustPoints(@Param('id') id: string, @Body() dto: AdjustCustomerPointsDto, @Req() req: AuthenticatedRequest) {
    return this.customerService.adjustPoints(id, dto, req.user)
  }

  @Get(':id')
  @Permissions('customer.read.all', 'customer.read.assigned')
  @ApiOperation({ summary: 'Chi tiết khách hàng' })
  findById(@Param('id') id: string, @Query('months') months?: string, @Req() req?: AuthenticatedRequest) {
    const tierRetentionMonths = months ? parseInt(months, 10) : 6
    return this.customerService.findById(id, tierRetentionMonths, req?.user)
  }

  @Post()
  @Permissions('customer.create')
  @ApiOperation({ summary: 'Tạo khách hàng mới' })
  create(@Body() dto: CreateCustomerDto, @Req() req: AuthenticatedRequest) {
    return this.customerService.create(dto, req.user, getRequestedBranchId(req))
  }

  @Put(':id')
  @Permissions('customer.update')
  @ApiOperation({ summary: 'Cập nhật khách hàng' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto, @Req() req: AuthenticatedRequest) {
    return this.customerService.update(id, dto, req.user)
  }

  @Delete(':id')
  @Permissions('customer.delete')
  @ApiOperation({ summary: 'Xóa khách hàng an toàn' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.customerService.remove(id, req.user)
  }
}
