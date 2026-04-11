import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UnauthorizedException, UseGuards } from '@nestjs/common'
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger'
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import {
  CreateVaultCollectionDto,
  EndShiftDto,
  FindCashVaultEntriesDto,
  FindShiftSessionsDto,
  ShiftsService,
  StartShiftDto,
  UpdateShiftReviewDto,
} from './shifts.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@ApiTags('Shifts')
@Controller('shifts')
@UseGuards(JwtGuard, PermissionsGuard)
@ApiBearerAuth()
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  private getStaffId(req: AuthenticatedRequest): string {
    const staffId = req.user?.userId
    if (!staffId) {
      throw new UnauthorizedException('Thieu thong tin nguoi dung trong token')
    }
    return staffId
  }

  @Get('current')
  @Permissions('order.pay', 'report.cashbook')
  @ApiOperation({ summary: 'Ca POS hien tai cua nhan vien tai chi nhanh' })
  getCurrent(@Req() req: AuthenticatedRequest) {
    return this.shiftsService.getCurrentShift(this.getStaffId(req), req.user, getRequestedBranchId(req))
  }

  @Get()
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Danh sach ca tien mat de doi soat' })
  findAll(@Query() query: FindShiftSessionsDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.findShiftSessions(query, req.user, getRequestedBranchId(req))
  }

  @Post('start')
  @Permissions('order.pay', 'report.cashbook')
  @ApiOperation({ summary: 'Mo so dau ca' })
  start(@Body() dto: StartShiftDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.startShift(dto, this.getStaffId(req), req.user, getRequestedBranchId(req))
  }

  @Get('vault/summary')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Tong hop tien ket theo chi nhanh' })
  getVaultSummary(@Query() query: FindCashVaultEntriesDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.getVaultSummary(query, req.user, getRequestedBranchId(req))
  }

  @Get('vault/ledger')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Timeline thu/chot tien ket theo chi nhanh' })
  findVaultLedger(@Query() query: FindCashVaultEntriesDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.findVaultEntries(query, req.user, getRequestedBranchId(req))
  }

  @Post('vault/collections')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Quan ly thu tien trong ket chi nhanh' })
  collectVault(@Body() dto: CreateVaultCollectionDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.collectVault(dto, this.getStaffId(req), req.user, getRequestedBranchId(req))
  }

  @Get(':id/summary')
  @Permissions('order.pay', 'report.cashbook')
  @ApiOperation({ summary: 'Tong ket ca tien mat' })
  getSummary(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.getShiftSummary(id, this.getStaffId(req), req.user)
  }

  @Post(':id/end')
  @Permissions('order.pay', 'report.cashbook')
  @ApiOperation({ summary: 'Chot so cuoi ca hoac chot lai trong ngay' })
  end(@Param('id') id: string, @Body() dto: EndShiftDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.endShift(id, dto, this.getStaffId(req), req.user)
  }

  @Patch(':id')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Quan ly cap nhat / duyet ca tien mat' })
  update(@Param('id') id: string, @Body() dto: UpdateShiftReviewDto, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.updateShiftReview(id, dto, this.getStaffId(req), req.user)
  }

  @Delete(':id')
  @Permissions('report.cashbook')
  @ApiOperation({ summary: 'Admin xoa ca tien mat da chot' })
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.shiftsService.deleteShift(id, req.user)
  }
}
