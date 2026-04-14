import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
  BadRequestException,
  UseGuards,
} from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { StockCountService } from './stock-count.service.js'
import {
  CreateStockCountSessionDto,
  AssignShiftsDto,
  SubmitCountItemDto,
  ApproveSessionDto,
  StartShiftSessionDto,
  ClaimRandomShiftDto,
} from './dto/index.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Stock Count')
@Controller('stock-count')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class StockCountController {
  constructor(private readonly stockCountService: StockCountService) {}

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) {
      throw new UnauthorizedException('Thieu thong tin nguoi dung trong token')
    }
    return staffId
  }

  @Post('sessions')
  @Permissions('stock_count.create')
  @ApiOperation({ summary: 'Tao phieu kiem kho tuan moi va sinh ca kiem theo lich san pham' })
  createSession(@Req() req: AuthenticatedRequest, @Body() dto: CreateStockCountSessionDto) {
    return this.stockCountService.createSession(this.getStaffId(req), dto)
  }

  @Get('sessions')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Danh sach phieu kiem kho' })
  findSessions(
    @Query('branchId') branchId: string,
    @Query('weekNumber') weekNumber?: number,
    @Query('year') year?: number,
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    if (!branchId) {
      throw new BadRequestException('branchId is required')
    }
    return this.stockCountService.findSessions(branchId, weekNumber, year, page, limit)
  }

  @Get('sessions/:id')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Chi tiet phieu kiem kho' })
  findSessionById(@Param('id') id: string) {
    return this.stockCountService.findSessionById(id)
  }

  @Post('sessions/:id/assign-shifts')
  @Permissions('stock_count.update')
  @ApiOperation({ summary: 'Dong bo lai ca kiem theo lich san pham' })
  assignShifts(@Param('id') id: string, @Body() dto: AssignShiftsDto) {
    return this.stockCountService.assignShiftsToProducts(id, dto)
  }

  @Post('sessions/:id/claim-random-shift')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Nhan ngau nhien mot ca chua kiem theo ngay duoc chon' })
  claimRandomShift(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ClaimRandomShiftDto,
  ) {
    return this.stockCountService.claimRandomShift(id, this.getStaffId(req), dto)
  }

  @Get('shifts/:shiftId')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Chi tiet ca kiem' })
  findShiftSession(@Param('shiftId') shiftId: string) {
    return this.stockCountService.getShiftSessionDetail(shiftId)
  }

  @Post('shifts/:shiftId/start')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Bat dau hoac mo lai ca kiem' })
  startShiftSession(
    @Param('shiftId') shiftId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto?: StartShiftSessionDto,
  ) {
    return this.stockCountService.startShiftSession(shiftId, this.getStaffId(req), dto)
  }

  @Post('shifts/:shiftId/complete')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Hoan thanh ca kiem' })
  completeShiftSession(@Param('shiftId') shiftId: string, @Req() req: AuthenticatedRequest) {
    return this.stockCountService.completeShiftSession(shiftId, this.getStaffId(req))
  }

  @Post('items/:id/count')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Nhap so chenh lech cho san pham kiem kho' })
  submitCountItem(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitCountItemDto,
  ) {
    return this.stockCountService.submitCountItem(id, this.getStaffId(req), dto)
  }

  @Post('sessions/:id/approve')
  @Permissions('stock_count.approve')
  @ApiOperation({ summary: 'Duyet phieu kiem kho va ap chenhlech vao ton kho' })
  approveSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.stockCountService.approveSession(id, this.getStaffId(req))
  }

  @Post('sessions/:id/reject')
  @Permissions('stock_count.approve')
  @ApiOperation({ summary: 'Tu choi phieu kiem kho' })
  rejectSession(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApproveSessionDto,
  ) {
    return this.stockCountService.rejectSession(id, this.getStaffId(req), dto)
  }

  @Get('progress/:branchId/:weekNumber/:year')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Tien do kiem kho tuan theo chi nhanh' })
  getWeeklyProgress(
    @Param('branchId') branchId: string,
    @Param('weekNumber') weekNumber: number,
    @Param('year') year: number,
  ) {
    return this.stockCountService.getWeeklyProgress(branchId, weekNumber, year)
  }
}
