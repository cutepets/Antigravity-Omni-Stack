import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
  Query,
} from '@nestjs/common'
import { GroomingService } from './grooming.service.js'
import { CreateGroomingDto, UpdateGroomingDto } from './dto/grooming.dto.js'
import { JwtGuard } from '../auth/guards/jwt.guard.js'

@Controller('grooming')
@UseGuards(JwtGuard)
export class GroomingController {
  constructor(private readonly groomingService: GroomingService) {}

  @Post()
  create(@Body() dto: CreateGroomingDto) {
    return this.groomingService.create(dto)
  }

  @Get()
  findAll(@Query() query: any) {
    return this.groomingService.findAll(query)
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.groomingService.findOne(id)
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateGroomingDto) {
    return this.groomingService.update(id, dto)
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.groomingService.remove(id)
  }
}
