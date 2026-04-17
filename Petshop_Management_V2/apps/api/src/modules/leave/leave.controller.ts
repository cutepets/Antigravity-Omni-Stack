import { Controller, Get, Post, Body, Param, Query, Patch, Request, UseGuards } from '@nestjs/common';
import { LeaveService } from './leave.service';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/leave.dto';
import { LeaveStatus } from '@petshop/database';
import { JwtGuard } from '../auth/guards/jwt.guard.js';

@UseGuards(JwtGuard)
@Controller('leave')
export class LeaveController {
    constructor(private readonly service: LeaveService) { }

    @Post()
    create(@Body() dto: CreateLeaveDto) {
        return this.service.create(dto);
    }

    @Patch('approve')
    approve(@Body() dto: ApproveLeaveDto, @Request() req: any) {
        return this.service.approve(dto, req.user.id);
    }

    @Patch(':id/cancel')
    cancel(@Param('id') id: string, @Request() req: any) {
        return this.service.cancel(id, req.user.id);
    }

    @Get()
    list(@Query() query: any) {
        return this.service.list(query);
    }

    @Get('branch/:branchId')
    getByBranch(
        @Param('branchId') branchId: string,
        @Query('status') status?: LeaveStatus,
    ) {
        return this.service.getByBranch(branchId, status);
    }

    @Get('user/:userId')
    getByUser(@Param('userId') userId: string) {
        return this.service.getByUser(userId);
    }

    @Get('balance/:userId')
    getBalance(
        @Param('userId') userId: string,
        @Query('year') year: string,
    ) {
        return this.service.getLeaveBalance(userId, Number(year || new Date().getFullYear()));
    }
}
