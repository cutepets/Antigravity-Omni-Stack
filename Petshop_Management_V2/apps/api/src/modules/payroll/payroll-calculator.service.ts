import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AttendanceStatus, GroomingStatus } from '@petshop/database';
import { CalculatePayrollDto } from './dto/payroll.dto';

const BHXH_RATE = 0.08;   // 8%
const BHYT_RATE = 0.015;  // 1.5%
const BHTN_RATE = 0.01;   // 1%

/** Tính thuế TNCN theo biểu lũy tiến Việt Nam (2024) */
function calcPIT(taxableIncome: number): number {
    // Giảm trừ gia cảnh: 11,000,000/tháng
    const deduction = 11_000_000;
    const taxable = Math.max(0, taxableIncome - deduction);
    if (taxable <= 0) return 0;

    const brackets = [
        { limit: 5_000_000, rate: 0.05 },
        { limit: 10_000_000, rate: 0.10 },
        { limit: 18_000_000, rate: 0.15 },
        { limit: 32_000_000, rate: 0.20 },
        { limit: 52_000_000, rate: 0.25 },
        { limit: 80_000_000, rate: 0.30 },
        { limit: Infinity, rate: 0.35 },
    ];

    let tax = 0;
    let remaining = taxable;
    let prev = 0;
    for (const b of brackets) {
        const bandwidth = b.limit - prev;
        if (remaining <= 0) break;
        const portion = Math.min(remaining, bandwidth);
        tax += portion * b.rate;
        remaining -= portion;
        prev = b.limit;
    }
    return Math.round(tax);
}

@Injectable()
export class PayrollCalculatorService {
    constructor(private prisma: DatabaseService) { }

    async calculateForPeriod(dto: CalculatePayrollDto) {
        const period = await this.prisma.payrollPeriod.findUniqueOrThrow({
            where: { id: dto.periodId },
            include: { branch: true },
        });

        // Lấy danh sách nhân viên cần tính
        const users = await this.prisma.user.findMany({
            where: {
                branchId: period.branchId,
                ...(dto.userIds && dto.userIds.length > 0 ? { id: { in: dto.userIds } } : {}),
                status: { in: ['WORKING', 'PROBATION', 'OFFICIAL'] },
            },
            select: {
                id: true,
                fullName: true,
                baseSalary: true,
                spaCommissionRate: true,
                employmentType: true,
            },
        });

        const startDate = new Date(period.year, period.month - 1, 1);
        const endDate = new Date(period.year, period.month, 0, 23, 59, 59);

        const slips = [];
        for (const user of users) {
            const slip = await this.calculateForUser(user, period.id, startDate, endDate, dto);
            slips.push(slip);
        }

        // Cập nhật tổng kỳ lương
        const totalAmount = slips.reduce((s: number, sl: any) => s + sl.totalNet, 0);
        await this.prisma.payrollPeriod.update({
            where: { id: period.id },
            data: { status: 'CALCULATED', totalAmount },
        });

        return { period, slips, totalAmount };
    }

    private async calculateForUser(
        user: any,
        periodId: string,
        startDate: Date,
        endDate: Date,
        opts: CalculatePayrollDto,
    ) {
        const baseSalary = user.baseSalary ?? 0;
        const standardDays = 26;
        const dailyRate = standardDays > 0 ? baseSalary / standardDays : 0;
        const hourlyRate = dailyRate / 8;

        // 1. Đếm ngày công
        const attendances = await this.prisma.attendanceRecord.findMany({
            where: {
                userId: user.id,
                date: { gte: startDate, lte: endDate },
                status: { in: [AttendanceStatus.AUTO_APPROVED, AttendanceStatus.APPROVED] },
            },
        });

        const workingDays = attendances.filter((a: any) => !a.isLeave).length;
        const leaveDays = attendances.filter((a: any) => a.isLeave).length;
        const overtimeHours = attendances.reduce((s: number, a: any) => s + (a.overtimeHours ?? 0), 0);
        const lateMinutesTotal = attendances.reduce((s: number, a: any) => s + (a.lateMinutes ?? 0), 0);

        // 2. Ngày vắng
        const scheduledDays = await this.prisma.staffSchedule.count({
            where: {
                userId: user.id,
                date: { gte: startDate, lte: endDate },
                isActive: true,
            },
        });
        const absentDays = Math.max(0, scheduledDays - workingDays - leaveDays);

        // 3. Phụ cấp
        const activeDays = workingDays + leaveDays;
        const mealAllowance = (opts.mealAllowancePerDay ?? 0) * activeDays;
        const transportAllowance = (opts.transportAllowancePerDay ?? 0) * activeDays;

        // 4. OT pay
        const otMultiplier = opts.overtimeMultiplier ?? 1.5;
        const overtimePay = overtimeHours * hourlyRate * otMultiplier;

        // 5. Hoa hồng spa
        let spaCommission = 0;
        if (user.spaCommissionRate && user.spaCommissionRate > 0) {
            const groomingRevenue = await this.prisma.groomingSession.aggregate({
                where: {
                    staffId: user.id,
                    status: GroomingStatus.COMPLETED,
                    createdAt: { gte: startDate, lte: endDate },
                    price: { not: null },
                },
                _sum: { price: true },
            });
            spaCommission = (groomingRevenue._sum.price ?? 0) * user.spaCommissionRate;
        }

        // 6. Khấu trừ đi muộn
        const lateDeductionPerMin = opts.lateDeductionPerMinute ?? 0;
        const lateDeduction = lateMinutesTotal * lateDeductionPerMin;

        // 7. Trừ ngày nghỉ không phép
        const unpaidLeaveDeduct = absentDays * dailyRate;

        // 8. Gross
        const attendancePay = dailyRate * (workingDays + leaveDays);
        const totalGross = attendancePay + overtimePay + mealAllowance + transportAllowance + spaCommission;

        // 9. Bảo hiểm
        const socialInsurance = baseSalary * BHXH_RATE;
        const healthInsurance = baseSalary * BHYT_RATE;
        const unemploymentIns = baseSalary * BHTN_RATE;

        // 10. PIT
        const taxableGross = totalGross - socialInsurance - healthInsurance - unemploymentIns;
        const personalIncomeTax = calcPIT(taxableGross);

        // 11. Net
        const totalDeductions = socialInsurance + healthInsurance + unemploymentIns
            + personalIncomeTax + lateDeduction + unpaidLeaveDeduct;
        const totalNet = Math.max(0, totalGross - totalDeductions);

        // Upsert phiếu lương
        return this.prisma.payrollSlip.upsert({
            where: { periodId_userId: { periodId, userId: user.id } },
            update: {
                workingDays, standardDays, leaveDays, absentDays, overtimeHours,
                lateMinutes: lateMinutesTotal, baseSalary, dailyRate, attendancePay,
                overtimePay, mealAllowance, transportAllowance, spaCommission,
                socialInsurance, healthInsurance, unemploymentIns, personalIncomeTax,
                lateDeduction, unpaidLeaveDeduct,
                totalGross, totalDeductions, totalNet,
                status: 'DRAFT',
            },
            create: {
                periodId, userId: user.id,
                workingDays, standardDays, leaveDays, absentDays, overtimeHours,
                lateMinutes: lateMinutesTotal, baseSalary, dailyRate, attendancePay,
                overtimePay, mealAllowance, transportAllowance, spaCommission,
                socialInsurance, healthInsurance, unemploymentIns, personalIncomeTax,
                lateDeduction, unpaidLeaveDeduct,
                totalGross, totalDeductions, totalNet,
            },
        });
    }
}
