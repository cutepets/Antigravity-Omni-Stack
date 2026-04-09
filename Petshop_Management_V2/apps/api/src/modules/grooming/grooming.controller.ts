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
import { CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'
import { GroomingService } from './grooming.service.js'

interface AuthenticatedRequest extends Request {
  user?: JwtPayload
}

@Controller('grooming')
@UseGuards(JwtGuard, PermissionsGuard)
export class GroomingController {
  constructor(private readonly groomingService: GroomingService) {}

  @Post()
  @Permissions('grooming.create')
  create(@Body() dto: CreateGroomingDto, @Req() req: AuthenticatedRequest) {
    return this.groomingService.create(dto, req.user, getRequestedBranchId(req))
  }

  @Get()
  @Permissions('grooming.read')
  findAll(@Query() query: any, @Req() req: AuthenticatedRequest) {
    return this.groomingService.findAll(query, req.user, getRequestedBranchId(req))
  }

  @Get(':id')
  @Permissions('grooming.read')
  findOne(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.groomingService.findOne(id, req.user)
  }

  @Patch(':id')
  @Permissions('grooming.update', 'grooming.start', 'grooming.complete', 'grooming.cancel')
  update(@Param('id') id: string, @Body() dto: UpdateGroomingDto, @Req() req: AuthenticatedRequest) {
    return this.groomingService.update(id, dto, req.user, getRequestedBranchId(req))
  }

  @Delete(':id')
  @Permissions('grooming.cancel')
  remove(@Param('id') id: string, @Req() req: AuthenticatedRequest) {
    return this.groomingService.remove(id, req.user)
  }
}
