import { Body, Controller, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CreatePromotionDto, GenerateVouchersDto, PromotionPreviewDto, UpdatePromotionDto } from './dto/promotion.dto.js'
import { PromotionsService } from './promotions.service.js'

@ApiTags('Promotions')
@Controller('promotions')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class PromotionsController {
  constructor(private readonly promotionsService: PromotionsService) {}

  @Get()
  @Permissions('promotions.read')
  list(@Query() query: Record<string, unknown>) {
    return this.promotionsService.list(query)
  }

  @Post()
  @Permissions('promotions.manage')
  create(@Body() dto: CreatePromotionDto, @Req() req: any) {
    return this.promotionsService.create(dto, req.user?.userId)
  }

  @Get('vouchers')
  @Permissions('promotions.voucher.manage')
  listVouchers(@Query() query: Record<string, unknown>) {
    return this.promotionsService.listVouchers(query)
  }

  @Post('vouchers/generate')
  @Permissions('promotions.voucher.manage')
  generateVouchers(@Body() dto: GenerateVouchersDto, @Req() req: any) {
    return this.promotionsService.generateVouchers(dto, req.user?.userId)
  }

  @Post('vouchers/validate')
  @Permissions('promotions.read')
  validateVoucher(@Body() dto: PromotionPreviewDto) {
    return this.promotionsService.preview(dto)
  }

  @Get('reports/summary')
  @Permissions('promotions.report.read')
  reportSummary() {
    return this.promotionsService.reportSummary()
  }

  @Post('preview')
  @Permissions('promotions.read', 'pos.sell', 'order.create', 'order.update')
  preview(@Body() dto: PromotionPreviewDto) {
    return this.promotionsService.preview(dto)
  }

  @Get(':id')
  @Permissions('promotions.read')
  findOne(@Param('id') id: string) {
    return this.promotionsService.findOne(id)
  }

  @Patch(':id')
  @Permissions('promotions.manage')
  update(@Param('id') id: string, @Body() dto: UpdatePromotionDto, @Req() req: any) {
    return this.promotionsService.update(id, dto, req.user?.userId)
  }

  @Post(':id/activate')
  @Permissions('promotions.activate')
  activate(@Param('id') id: string, @Req() req: any) {
    return this.promotionsService.activate(id, req.user?.userId)
  }

  @Post(':id/deactivate')
  @Permissions('promotions.activate')
  deactivate(@Param('id') id: string, @Req() req: any) {
    return this.promotionsService.deactivate(id, req.user?.userId)
  }
}
