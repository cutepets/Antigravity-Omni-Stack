import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UnauthorizedException,
  NotFoundException,
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
} from './dto/index.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Stock Count')
@Controller('stock-count')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class StockCountController {
  constructor(private readonly stockCountService: StockCountService) { }

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) throw new UnauthorizedException('Thiếu thông tin người dùng trong token')
    return staffId
  }

  // ===========================================================================
  // SESSION CRUD
  // ===========================================================================

  @Post('sessions')
  @Permissions('stock_count.create')
  @ApiOperation({ summary: 'Tạo phiếu kiểm kho tuần mới' })
  createSession(@Req() req: AuthenticatedRequest, @Body() dto: CreateStockCountSessionDto) {
    return this.stockCountService.createSession(this.getStaffId(req), dto)
  }

  @Get('sessions')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Danh sách phiếu kiểm kho' })
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
  @ApiOperation({ summary: 'Chi tiết phiếu kiểm kho' })
  findSessionById(@Param('id') id: string) {
    return this.stockCountService.findSessionById(id)
  }

  // ===========================================================================
  // SHIFT ASSIGNMENT
  // ===========================================================================

  @Post('sessions/:id/assign-shifts')
  @Permissions('stock_count.update')
  @ApiOperation({ summary: 'Phân ca kiểm ngẫu nhiên cho sản phẩm' })
  assignShifts(@Param('id') id: string, @Body() dto: AssignShiftsDto) {
    return this.stockCountService.assignShiftsToProducts(id, dto)
  }

  // ===========================================================================
  // SHIFT SESSION OPERATIONS
  // ===========================================================================

  @Get('shifts/:shiftId')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Chi tiết ca kiểm' })
  findShiftSession(@Param('shiftId') shiftId: string) {
    return this.stockCountService.getShiftSessionDetail(shiftId)
  }

  @Post('shifts/:shiftId/start')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Bắt đầu ca kiểm' })
  startShiftSession(
    @Param('shiftId') shiftId: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto?: StartShiftSessionDto,
  ) {
    return this.stockCountService.startShiftSession(shiftId, this.getStaffId(req), dto)
  }

  @Post('shifts/:shiftId/complete')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Hoàn thành ca kiểm' })
  completeShiftSession(@Param('shiftId') shiftId: string) {
    return this.stockCountService.completeShiftSession(shiftId)
  }

  // ===========================================================================
  // COUNTING ITEMS
  // ===========================================================================

  @Post('items/:id/count')
  @Permissions('stock_count.count')
  @ApiOperation({ summary: 'Nhập số lượng kiểm cho sản phẩm' })
  submitCountItem(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: SubmitCountItemDto,
  ) {
    return this.stockCountService.submitCountItem(id, this.getStaffId(req), dto)
  }

  // ===========================================================================
  // APPROVAL WORKFLOW
  // ===========================================================================

  @Post('sessions/:id/approve')
  @Permissions('stock_count.approve')
  @ApiOperation({ summary: 'Duyệt phiếu kiểm kho' })
  approveSession(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.stockCountService.approveSession(id, this.getStaffId(req))
  }

  @Post('sessions/:id/reject')
  @Permissions('stock_count.approve')
  @ApiOperation({ summary: 'Từ chối phiếu kiểm kho' })
  rejectSession(
    @Param('id') id: string,
    @Req() req: AuthenticatedRequest,
    @Body() dto: ApproveSessionDto,
  ) {
    return this.stockCountService.rejectSession(id, this.getStaffId(req), dto)
  }

  // ===========================================================================
  // PROGRESS TRACKING
  // ===========================================================================

  @Get('progress/:branchId/:weekNumber/:year')
  @Permissions('stock_count.read')
  @ApiOperation({ summary: 'Tiến độ kiểm kho tuần theo chi nhánh' })
  getWeeklyProgress(
    @Param('branchId') branchId: string,
    @Param('weekNumber') weekNumber: number,
    @Param('year') year: number,
  ) {
    return this.stockCountService.getWeeklyProgress(branchId, weekNumber, year)
  }
}
