import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common'
import { CommandBus, QueryBus } from '@nestjs/cqrs'
import type { PaymentStatus } from '@petshop/database'
import type { JwtPayload } from '@petshop/shared'
import type { Request } from 'express'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { RequireModule } from '../../common/decorators/require-module.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { SuperAdminGuard } from '../../common/security/super-admin.guard.js'
import { normalizeBulkDeleteIds, runBulkDelete } from '../../common/utils/bulk-delete.util.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CreateCageDto, CreateHotelRateTableDto, CreateHotelStayDto, CreateHotelStayHealthLogDto, CreateHotelStayNoteDto } from './dto/create-hotel.dto.js'
import { CalculateHotelPriceDto, CheckoutHotelStayDto, UpdateCageDto, UpdateHotelRateTableDto, UpdateHotelStayDto } from './dto/update-hotel.dto.js'

// Commands
import { CreateCageCommand } from './application/commands/create-cage/create-cage.command.js'
import { UpdateCageCommand } from './application/commands/update-cage/update-cage.command.js'
import { DeleteCageCommand } from './application/commands/delete-cage/delete-cage.command.js'
import { ReorderCagesCommand } from './application/commands/reorder-cages/reorder-cages.command.js'
import { CreateRateTableCommand } from './application/commands/create-rate-table/create-rate-table.command.js'
import { UpdateRateTableCommand } from './application/commands/update-rate-table/update-rate-table.command.js'
import { DeleteRateTableCommand } from './application/commands/delete-rate-table/delete-rate-table.command.js'
import { CreateStayCommand } from './application/commands/create-stay/create-stay.command.js'
import { UpdateStayCommand } from './application/commands/update-stay/update-stay.command.js'
import { UpdateStayPaymentCommand } from './application/commands/update-stay-payment/update-stay-payment.command.js'
import { CheckoutStayCommand } from './application/commands/checkout-stay/checkout-stay.command.js'
import { DeleteStayCommand } from './application/commands/delete-stay/delete-stay.command.js'
import { CreateStayHealthLogCommand } from './application/commands/create-stay-health-log/create-stay-health-log.command.js'
import { CreateStayNoteCommand } from './application/commands/create-stay-note/create-stay-note.command.js'

// Queries
import { FindAllCagesQuery } from './application/queries/find-all-cages/find-all-cages.query.js'
import { FindAllRateTablesQuery } from './application/queries/find-all-rate-tables/find-all-rate-tables.query.js'
import { FindRateTableQuery } from './application/queries/find-rate-table/find-rate-table.query.js'
import { FindAllStaysQuery } from './application/queries/find-all-stays/find-all-stays.query.js'
import { FindStayQuery } from './application/queries/find-stay/find-stay.query.js'
import { FindStayTimelineQuery } from './application/queries/find-stay-timeline/find-stay-timeline.query.js'
import { FindStayHealthLogsQuery } from './application/queries/find-stay-health-logs/find-stay-health-logs.query.js'
import { CalculateHotelPriceQuery } from './application/queries/calculate-hotel-price/calculate-hotel-price.query.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@RequireModule('hotel')
@Controller('hotel')
@UseGuards(JwtGuard, PermissionsGuard)
export class HotelController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) { }

  // ===== CAGES =====
  @Post('cages')
  @Permissions('hotel.create')
  createCage(@Body() dto: CreateCageDto) {
    return this.commandBus.execute(new CreateCageCommand(dto))
  }

  @Get('cages')
  @Permissions('hotel.read')
  findAllCages(): Promise<any> {
    return this.queryBus.execute(new FindAllCagesQuery())
  }

  @Patch('cages/reorder')
  @Permissions('hotel.update')
  reorderCages(@Body('cageIds') cageIds: string[]) {
    return this.commandBus.execute(new ReorderCagesCommand(cageIds))
  }

  @Patch('cages/:id')
  @Permissions('hotel.update')
  updateCage(@Param('id') id: string, @Body() dto: UpdateCageDto) {
    return this.commandBus.execute(new UpdateCageCommand(id, dto))
  }

  @Delete('cages/:id')
  @Permissions('hotel.cancel')
  deleteCage(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteCageCommand(id))
  }

  // ===== RATE TABLES =====
  @Post('rate-tables')
  @Permissions('hotel.create')
  createRateTable(@Body() dto: CreateHotelRateTableDto) {
    return this.commandBus.execute(new CreateRateTableCommand(dto))
  }

  @Get('rate-tables')
  @Permissions('hotel.read')
  findAllRateTables(@Query() query: any) {
    return this.queryBus.execute(new FindAllRateTablesQuery(query))
  }

  @Get('rate-tables/:id')
  @Permissions('hotel.read')
  findRateTableById(@Param('id') id: string) {
    return this.queryBus.execute(new FindRateTableQuery(id))
  }

  @Patch('rate-tables/:id')
  @Permissions('hotel.update')
  updateRateTable(@Param('id') id: string, @Body() dto: UpdateHotelRateTableDto) {
    return this.commandBus.execute(new UpdateRateTableCommand(id, dto))
  }

  @Delete('rate-tables/:id')
  @Permissions('hotel.cancel')
  deleteRateTable(@Param('id') id: string) {
    return this.commandBus.execute(new DeleteRateTableCommand(id))
  }

  // ===== STAYS =====
  @Post('stays')
  @Permissions('hotel.create', 'hotel.checkin')
  createStay(@Body() dto: CreateHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new CreateStayCommand(dto, req.user, getRequestedBranchId(req)))
  }

  @Get('stays')
  @Permissions('hotel.read')
  findAllStays(@Query() query: any, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindAllStaysQuery(query, req.user, getRequestedBranchId(req)))
  }

  @Post('stays/bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('hotel.cancel')
  bulkDeleteStays(@Body() body: { ids?: string[] }, @Req() req: AuthenticatedRequest) {
    const ids = normalizeBulkDeleteIds(body.ids)
    return runBulkDelete(ids, (id) => this.commandBus.execute(new DeleteStayCommand(id, req.user)))
  }

  @Get('stays/code/:code')
  @Permissions('hotel.read')
  findStayByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindStayQuery(code, req.user))
  }

  @Get('stays/:id')
  @Permissions('hotel.read')
  findStayById(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindStayQuery(id, req.user))
  }

  @Get('stays/:id/timeline')
  @Permissions('hotel.read')
  findStayTimeline(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindStayTimelineQuery(id, req.user))
  }

  @Get('stays/:id/health-logs')
  @Permissions('hotel.read')
  findStayHealthLogs(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindStayHealthLogsQuery(id, req.user))
  }

  @Post('stays/:id/health-logs')
  @Permissions('hotel.update')
  createStayHealthLog(
    @Param('id') id: string,
    @Body() dto: CreateHotelStayHealthLogDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.commandBus.execute(new CreateStayHealthLogCommand(id, dto, req.user))
  }

  @Post('stays/:id/notes')
  @Permissions('hotel.update')
  createStayNote(
    @Param('id') id: string,
    @Body() dto: CreateHotelStayNoteDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<any> {
    return this.commandBus.execute(new CreateStayNoteCommand(id, dto, req.user))
  }

  @Patch('stays/:id')
  @Permissions('hotel.update')
  updateStay(@Param('id') id: string, @Body() dto: UpdateHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new UpdateStayCommand(id, dto, req.user, getRequestedBranchId(req)))
  }

  @Patch('stays/:id/payment')
  @Permissions('hotel.update')
  updateStayPayment(@Param('id') id: string, @Body('paymentStatus') paymentStatus: PaymentStatus, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new UpdateStayPaymentCommand(id, paymentStatus, req.user))
  }

  @Post('stays/:id/checkout')
  @Permissions('hotel.checkout')
  checkoutStay(@Param('id') id: string, @Body() dto: CheckoutHotelStayDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new CheckoutStayCommand(id, dto, req.user))
  }

  @Delete('stays/:id')
  @Permissions('hotel.cancel')
  deleteStay(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new DeleteStayCommand(id, req.user))
  }

  // ===== CALCULATE =====
  @Post('calculate')
  @Permissions('hotel.read', 'hotel.create')
  calculatePrice(@Body() dto: CalculateHotelPriceDto) {
    return this.queryBus.execute(new CalculateHotelPriceQuery(dto))
  }
}
