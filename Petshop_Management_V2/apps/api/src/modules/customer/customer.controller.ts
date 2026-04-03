import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseBoolPipe,
  Optional,
} from '@nestjs/common'
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger'
import {
  CustomerService,
  CreateCustomerDto,
  UpdateCustomerDto,
  FindCustomersDto,
  ImportCustomerRow,
} from './customer.service.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

@ApiTags('Customers')
@Controller('customers')
@UseGuards(JwtGuard)
@ApiBearerAuth()
export class CustomerController {
  constructor(private readonly customerService: CustomerService) {}

  @Get()
  @ApiOperation({ summary: 'Danh sách khách hàng (hỗ trợ tìm kiếm không dấu, filter nâng cao)' })
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
  findAll(@Query() query: FindCustomersDto) {
    return this.customerService.findAll(query)
  }

  @Get('export')
  @ApiOperation({ summary: 'Export toàn bộ khách hàng (không phân trang)' })
  @ApiQuery({ name: 'tier', required: false })
  @ApiQuery({ name: 'isActive', required: false })
  exportAll(
    @Query('tier') tier?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined
    return this.customerService.exportAll({
      ...(tier !== undefined && { tier }),
      ...(isActiveBool !== undefined && { isActive: isActiveBool }),
    })
  }

  @Post('import')
  @ApiOperation({ summary: 'Import batch khách hàng từ JSON rows' })
  importBatch(@Body() body: { rows: ImportCustomerRow[] }) {
    return this.customerService.importBatch(body.rows || [])
  }

  @Get(':id')
  @ApiOperation({ summary: 'Chi tiết khách hàng (hỗ trợ lookup bằng ID hoặc mã KH-000001)' })
  findById(@Param('id') id: string, @Query('months') months?: string) {
    const tierRetentionMonths = months ? parseInt(months) : 6
    return this.customerService.findById(id, tierRetentionMonths)
  }

  @Post()
  @ApiOperation({ summary: 'Tạo khách hàng mới' })
  create(@Body() dto: CreateCustomerDto) {
    return this.customerService.create(dto)
  }

  @Put(':id')
  @ApiOperation({ summary: 'Cập nhật khách hàng' })
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.customerService.update(id, dto)
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Xóa khách hàng (safe — kiểm tra quan hệ trước khi xóa)' })
  remove(@Param('id') id: string) {
    return this.customerService.remove(id)
  }
}
