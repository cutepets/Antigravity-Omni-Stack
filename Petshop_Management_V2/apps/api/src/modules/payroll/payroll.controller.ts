import { Controller, Get, Post, Body, Param, Patch, Request, UseGuards, Query } from '@nestjs/common';
import { PayrollService } from './payroll.service';
import { CreatePayrollPeriodDto, CalculatePayrollDto, UpdateSlipDto } from './dto/payroll.dto';
import { JwtGuard } from '../auth/guards/jwt.guard.js';
import { RequireModule } from '../../common/decorators/require-module.decorator.js';
import { ModuleGuard } from '../../common/guards/module.guard.js';

@RequireModule('payroll')
@UseGuards(JwtGuard, ModuleGuard)
@Controller('payroll')
export class PayrollController {
    constructor(private readonly service: PayrollService) { }

    @Post('periods')
    createPeriod(@Body() dto: CreatePayrollPeriodDto, @Request() req: any) {
        return this.service.createPeriod(dto, req.user.id);
    }

    @Post('calculate')
    calculate(@Body() dto: CalculatePayrollDto) {
        return this.service.calculate(dto);
    }

    @Patch('periods/:id/approve')
    approve(@Param('id') id: string, @Request() req: any) {
        return this.service.approvePeriod(id, req.user.id);
    }

    @Patch('periods/:id/paid')
    markPaid(@Param('id') id: string) {
        return this.service.markPaid(id);
    }

    @Get('periods')
    listPeriods(@Query('branchId') branchId?: string, @Request() req?: any) {
        return this.service.listPeriods(branchId || req?.user?.branchId || 'default');
    }

    @Get('periods/:branchId')
    listPeriodsByParam(@Param('branchId') branchId: string) {
        return this.service.listPeriods(branchId);
    }

    @Get('periods/detail/:id')
    getPeriodDetail(@Param('id') id: string) {
        return this.service.getPeriodDetail(id);
    }

    @Get('slips')
    listSlips(@Query() query: any) {
        return this.service.listSlips(query);
    }

    @Get('slips/:id')
    getSlip(@Param('id') id: string) {
        return this.service.getSlip(id);
    }

    @Patch('slips/:id')
    updateSlip(@Param('id') id: string, @Body() dto: UpdateSlipDto) {
        return this.service.updateSlip(id, dto);
    }
}
