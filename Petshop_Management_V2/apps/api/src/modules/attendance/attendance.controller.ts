import { Controller, Get, Post, Body, Param, Query, Patch, Request, UseGuards } from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { ClockInDto, ClockOutDto, ManualAttendanceDto, ReviewAttendanceDto, BulkReviewDto } from './dto/clock.dto';
import { JwtGuard } from '../auth/guards/jwt.guard.js';

@UseGuards(JwtGuard)
@Controller('attendance')
export class AttendanceController {
    constructor(private readonly service: AttendanceService) { }

    @Get()
    list(@Query() query: any) {
        return this.service.list(query);
    }

    @Post('clock-in')
    clockIn(@Body() dto: ClockInDto) {
        return this.service.clockIn(dto);
    }

    @Post('clock-out')
    clockOut(@Body() dto: ClockOutDto) {
        return this.service.clockOut(dto);
    }

    @Post('manual')
    manual(@Body() dto: ManualAttendanceDto, @Request() req: any) {
        return this.service.manualRecord(dto, req.user.id);
    }

    @Patch('review')
    review(@Body() dto: ReviewAttendanceDto, @Request() req: any) {
        return this.service.review(dto, req.user.id);
    }

    @Patch('bulk-review')
    bulkReview(@Body() dto: BulkReviewDto, @Request() req: any) {
        return this.service.bulkReview(dto, req.user.id);
    }

    @Get('branch/:branchId')
    getMonthly(
        @Param('branchId') branchId: string,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.service.getMonthlyByBranch(branchId, Number(year), Number(month));
    }

    @Get('user/:userId')
    getByUser(
        @Param('userId') userId: string,
        @Query('year') year: string,
        @Query('month') month: string,
    ) {
        return this.service.getByUser(userId, Number(year), Number(month));
    }

    @Get('pending/:branchId')
    getPending(@Param('branchId') branchId: string) {
        return this.service.getPending(branchId);
    }
}
