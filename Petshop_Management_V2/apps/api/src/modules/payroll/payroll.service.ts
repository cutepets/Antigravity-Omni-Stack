import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { PayrollCalculatorService } from './payroll-calculator.service';
import { CreatePayrollPeriodDto, CalculatePayrollDto, UpdateSlipDto } from './dto/payroll.dto';

@Injectable()
export class PayrollService {
    constructor(
        private prisma: DatabaseService,
        private calculator: PayrollCalculatorService,
    ) { }

    async createPeriod(dto: CreatePayrollPeriodDto, creatorId: string) {
        const startDate = new Date(dto.year, dto.month - 1, 1);
        const endDate = new Date(dto.year, dto.month, 0);

        return this.prisma.payrollPeriod.create({
            data: {
                branchId: dto.branchId,
                month: dto.month,
                year: dto.year,
                startDate,
                endDate,
                note: dto.note,
            },
        });
    }

    async calculate(dto: CalculatePayrollDto) {
        return this.calculator.calculateForPeriod(dto);
    }

    async approvePeriod(periodId: string, approverId: string) {
        return this.prisma.payrollPeriod.update({
            where: { id: periodId },
            data: {
                status: 'APPROVED',
                approvedBy: approverId,
                approvedAt: new Date(),
            },
        });
    }

    async markPaid(periodId: string) {
        return this.prisma.payrollPeriod.update({
            where: { id: periodId },
            data: { status: 'PAID', paidAt: new Date() },
        });
    }

    async listPeriods(branchId: string) {
        return this.prisma.payrollPeriod.findMany({
            where: { branchId },
            include: {
                _count: { select: { slips: true } },
                approver: { select: { fullName: true } },
            },
            orderBy: [{ year: 'desc' }, { month: 'desc' }],
        });
    }

    async getPeriodDetail(periodId: string) {
        return this.prisma.payrollPeriod.findUniqueOrThrow({
            where: { id: periodId },
            include: {
                slips: {
                    include: {
                        user: { select: { id: true, fullName: true, username: true, avatar: true, employmentType: true } },
                        lineItems: true,
                    },
                    orderBy: { user: { fullName: 'asc' } },
                },
                approver: { select: { fullName: true } },
            },
        });
    }

    async listSlips(query: any) {
        const where: any = {};
        if (query.periodId) where.periodId = query.periodId;
        if (query.staffId) where.staffId = query.staffId;
        if (query.status) where.status = query.status;

        return this.prisma.payrollSlip.findMany({
            where,
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
            orderBy: { user: { fullName: 'asc' } },
        });
    }

    async getSlip(slipId: string) {
        return this.prisma.payrollSlip.findUniqueOrThrow({
            where: { id: slipId },
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true, phone: true, branchId: true } },
                period: { include: { branch: { select: { name: true } } } },
                lineItems: true,
            },
        });
    }

    async updateSlip(slipId: string, dto: UpdateSlipDto) {
        const slip = await this.prisma.payrollSlip.findUniqueOrThrow({ where: { id: slipId } });

        // Recalculate totals
        const updatedAllowances = {
            mealAllowance: dto.mealAllowance ?? slip.mealAllowance,
            transportAllowance: dto.transportAllowance ?? slip.transportAllowance,
            performanceBonus: dto.performanceBonus ?? slip.performanceBonus,
            otherAllowances: dto.otherAllowances ?? slip.otherAllowances,
            otherDeductions: dto.otherDeductions ?? slip.otherDeductions,
        };

        const totalGross = slip.attendancePay
            + slip.overtimePay
            + updatedAllowances.mealAllowance
            + updatedAllowances.transportAllowance
            + updatedAllowances.performanceBonus
            + updatedAllowances.otherAllowances
            + slip.spaCommission;

        const totalDeductions = slip.socialInsurance + slip.healthInsurance
            + slip.unemploymentIns + slip.personalIncomeTax
            + slip.lateDeduction + slip.unpaidLeaveDeduct
            + updatedAllowances.otherDeductions;

        const totalNet = Math.max(0, totalGross - totalDeductions);

        return this.prisma.payrollSlip.update({
            where: { id: slipId },
            data: {
                ...updatedAllowances,
                totalGross,
                totalDeductions,
                totalNet,
                note: dto.note,
            },
        });
    }
}
