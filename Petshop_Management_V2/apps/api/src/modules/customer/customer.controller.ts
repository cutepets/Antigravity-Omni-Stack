import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
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
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  CreateCustomerDto,
  CustomerService,
  FindCustomersDto,
  ImportCustomerRow,
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
  @ApiQuery({ name: 'sortBy', required: false })
  @ApiQuery({ name: 'sortOrder', required: false, enum: ['asc', 'desc'] })
  findAll(@Query() query: FindCustomersDto, @Req() req: AuthenticatedRequest) {
    return this.customerService.findAll(query, req.user)
  }

  @Get('export')
  @Permissions('customer.read.all', 'customer.read.assigned')
  @ApiOperation({ summary: 'Export toàn bộ khách hàng' })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  exportAll(
    @Query('tier') tier?: string,
    @Query('isActive') isActive?: string,
    @Req() req?: AuthenticatedRequest,
  ) {
    const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined
    return this.customerService.exportAll({
      ...(tier !== undefined && { tier }),
      ...(isActiveBool !== undefined && { isActive: isActiveBool }),
    }, req?.user)
  }

  @Post('import')
  @Permissions('customer.create')
  @ApiOperation({ summary: 'Import batch khách hàng từ JSON rows' })
  importBatch(@Body() body: { rows: ImportCustomerRow[] }, @Req() req: AuthenticatedRequest) {
    return this.customerService.importBatch(body.rows || [], req.user, getRequestedBranchId(req))
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
