import { Controller, Get, Post, Body, Param, Query, Patch, Delete, UseGuards } from '@nestjs/common';
import { ScheduleService } from './schedule.service';
import { CreateScheduleDto, BulkCreateScheduleDto } from './dto/create-schedule.dto';
import { JwtGuard } from '../auth/guards/jwt.guard.js';

@UseGuards(JwtGuard)
@Controller('schedule')
export class ScheduleController {
    constructor(private readonly service: ScheduleService) { }

    @Post()
    create(@Body() dto: CreateScheduleDto) {
        return this.service.create(dto);
    }

    @Post('bulk')
    bulkCreate(@Body() dto: BulkCreateScheduleDto) {
        return this.service.bulkCreate(dto);
    }

    @Get()
    findAll(
        @Query('startDate') startDate?: string,
        @Query('endDate') endDate?: string,
        @Query('userId') userId?: string,
        @Query('branchId') branchId?: string,
    ) {
        return this.service.findAll({ startDate, endDate, userId, branchId });
    }

    @Get('branch/:branchId')
    getByBranch(
        @Param('branchId') branchId: string,
        @Query('from') from: string,
        @Query('to') to: string,
    ) {
        return this.service.findByBranchAndDate(branchId, from, to);
    }

    @Get('user/:userId')
    getByUser(
        @Param('userId') userId: string,
        @Query('from') from: string,
        @Query('to') to: string,
    ) {
        return this.service.findByUser(userId, from, to);
    }

    @Get(':id')
    getById(@Param('id') id: string) {
        return this.service.findById(id);
    }

    @Patch(':id')
    update(@Param('id') id: string, @Body() dto: Partial<CreateScheduleDto> & { isActive?: boolean }) {
        return this.service.update(id, dto);
    }

    @Delete(':id')
    delete(@Param('id') id: string) {
        return this.service.delete(id);
    }
}
