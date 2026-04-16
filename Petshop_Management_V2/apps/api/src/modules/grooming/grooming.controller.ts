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
import type { Request } from 'express'
import type { JwtPayload } from '@petshop/shared'
import { Permissions } from '../../common/decorators/permissions.decorator.js'
import { PermissionsGuard } from '../../common/guards/permissions.guard.js'
import { getRequestedBranchId } from '../../common/utils/request-branch.util.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'
import { CalculateSpaPriceDto, CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'
import { GroomingService } from './grooming.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('grooming')
@UseGuards(JwtGuard, PermissionsGuard)
export class GroomingController {
  constructor(private readonly groomingService: GroomingService) { }

  @Post()
  @Permissions('grooming.create')
  create(@Body() dto: CreateGroomingDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.create(dto, req.user, getRequestedBranchId(req))
  }

  @Post('calculate')
  @Permissions('grooming.read')
  calculatePrice(@Body() dto: CalculateSpaPriceDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.calculatePrice(dto, req.user)
  }

  @Get()
  @Permissions('grooming.read')
  findAll(@Query() query: any, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.findAll(query, req.user, getRequestedBranchId(req))
  }

  @Get('packages')
  @Permissions('grooming.read')
  getPackages(@Query('species') species?: string): Promise<any> {
    return this.groomingService.getPackages(species)
  }

  @Get('code/:code')
  @Permissions('grooming.read')
  findByCode(@Param('code') code: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.findByCode(code, req.user)
  }

  @Get(':id')
  @Permissions('grooming.read')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.findOne(id, req.user)
  }

  @Patch(':id')
  @Permissions('grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel')
  update(@Param('id') id: string, @Body() dto: UpdateGroomingDto, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.update(id, dto, req.user, getRequestedBranchId(req))
  }

  @Delete(':id')
  @Permissions('grooming.cancel')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest): Promise<any> {
    return this.groomingService.remove(id, req.user)
  }
}
