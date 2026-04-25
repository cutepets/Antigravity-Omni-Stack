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
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { RequireModule } from '../../common/decorators/require-module.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { SuperAdminGuard } from '../../common/security/super-admin.guard.js'
import { normalizeBulkDeleteIds, runBulkDelete } from '../../common/utils/bulk-delete.util.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CalculateSpaPriceDto, CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'

// Commands
import { CreateGroomingCommand } from './application/commands/create-grooming/create-grooming.command.js'
import { UpdateGroomingCommand } from './application/commands/update-grooming/update-grooming.command.js'
import { DeleteGroomingCommand } from './application/commands/delete-grooming/delete-grooming.command.js'

// Queries
import { FindGroomingsQuery } from './application/queries/find-groomings/find-groomings.query.js'
import { FindGroomingQuery } from './application/queries/find-grooming/find-grooming.query.js'
import { GetGroomingPackagesQuery } from './application/queries/get-grooming-packages/get-grooming-packages.query.js'
import { CalculateGroomingPriceQuery } from './application/queries/calculate-grooming-price/calculate-grooming-price.query.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@RequireModule('grooming')
@Controller('grooming')
@UseGuards(JwtGuard, PermissionsGuard)
export class GroomingController {
  constructor(
    private readonly commandBus: CommandBus,
    private readonly queryBus: QueryBus,
  ) { }

  @Post()
  @Permissions('grooming.create')
  create(@Body() dto: CreateGroomingDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new CreateGroomingCommand(dto, req.user, getRequestedBranchId(req)))
  }

  @Post('calculate')
  @Permissions('grooming.read')
  calculatePrice(@Body() dto: CalculateSpaPriceDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new CalculateGroomingPriceQuery(dto, req.user))
  }

  @Get()
  @Permissions('grooming.read')
  findAll(@Query() query: any, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindGroomingsQuery(query, req.user, getRequestedBranchId(req)))
  }

  @Get('packages')
  @Permissions('grooming.read')
  getPackages(@Query('species') species?: string): Promise<any> {
    return this.queryBus.execute(new GetGroomingPackagesQuery(species))
  }

  @Post('bulk-delete')
  @UseGuards(SuperAdminGuard)
  @Permissions('grooming.cancel')
  bulkRemove(@Body() body: { ids?: string[] }, @Req() req: AuthenticatedRequest) {
    const ids = normalizeBulkDeleteIds(body.ids)
    return runBulkDelete(ids, (id) => this.commandBus.execute(new DeleteGroomingCommand(id, req.user)))
  }

  @Get('code/:code')
  @Permissions('grooming.read')
  findByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindGroomingQuery(code, req.user))
  }

  @Get(':id')
  @Permissions('grooming.read')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.queryBus.execute(new FindGroomingQuery(id, req.user))
  }

  @Patch(':id')
  @Permissions('grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel')
  update(@Param('id') id: string, @Body() dto: UpdateGroomingDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new UpdateGroomingCommand(id, dto, req.user, getRequestedBranchId(req)))
  }

  @Delete(':id')
  @Permissions('grooming.cancel')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.commandBus.execute(new DeleteGroomingCommand(id, req.user))
  }
}
