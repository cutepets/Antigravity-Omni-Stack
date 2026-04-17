import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { AttendanceStatus, ClockMethod } from '@petshop/database';
import { ClockInDto, ClockOutDto, ManualAttendanceDto, ReviewAttendanceDto, BulkReviewDto } from './dto/clock.dto';
import { ScheduleService } from '../schedule/schedule.service';

const AUTO_APPROVE_FACE_THRESHOLD = 0.85;
const LATE_GRACE_MINUTES = 15; // Cho phép đến muộn tối đa

@Injectable()
export class AttendanceService {
    constructor(
        private prisma: DatabaseService,
        private scheduleService: ScheduleService,
    ) { }

    /** Lấy danh sách chấm công phân trang */
    async list(query: any) {
        const page = Number(query.page) || 1;
        const limit = Number(query.limit) || 15;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.status) where.status = query.status;
        if (query.staffId) where.userId = query.staffId;
        if (query.branchId) where.branchId = query.branchId;
        if (query.isManualEntry) {
            where.clockInMethod = query.isManualEntry === 'true' ? ClockMethod.MANUAL : { not: ClockMethod.MANUAL };
        }

        const [data, total] = await Promise.all([
            this.prisma.attendanceRecord.findMany({
                where,
                skip,
                take: limit,
                include: {
                    user: { select: { id: true, fullName: true, staffCode: true } },
                    schedule: true,
                },
                orderBy: { date: 'desc' },
            }),
            this.prisma.attendanceRecord.count({ where }),
        ]);

        return {
            data,
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    /** Chấm công vào — auto-approve nếu đủ điều kiện */
    async clockIn(dto: ClockInDto) {
        const now = dto.timestamp ? new Date(dto.timestamp) : new Date();
        const todayDate = new Date(now.toDateString());

        // Kiểm tra đã chấm hôm nay chưa
        const existing = await this.prisma.attendanceRecord.findFirst({
            where: { userId: dto.userId, date: todayDate, clockIn: { not: null } },
        });
        if (existing) {
            throw new BadRequestException('Nhân viên đã chấm công vào hôm nay.');
        }

        const schedule = await this.scheduleService.findTodaySchedule(dto.userId, dto.branchId);
        const status = this.determineStatus(dto, schedule, now);
        const lateMinutes = schedule ? this.calcLateMinutes(schedule.startTime, now) : null;

        return this.prisma.attendanceRecord.create({
            data: {
                userId: dto.userId,
                branchId: dto.branchId,
                scheduleId: schedule?.id ?? null,
                date: todayDate,
                clockIn: now,
                clockInMethod: dto.method ?? ClockMethod.MANUAL,
                faceConfidence: dto.faceConfidence ?? null,
                status,
                lateMinutes: lateMinutes && lateMinutes > 0 ? lateMinutes : null,
                note: dto.note,
            },
            include: {
                user: { select: { fullName: true, staffCode: true } },
                schedule: true,
            },
        });
    }

    /** Chấm công ra — tính số giờ làm */
    async clockOut(dto: ClockOutDto) {
        const record = await this.prisma.attendanceRecord.findUnique({
            where: { id: dto.attendanceId },
            include: { schedule: true },
        });
        if (!record) throw new NotFoundException('Không tìm thấy bản ghi chấm công.');
        if (record.clockOut) throw new BadRequestException('Đã chấm công ra rồi.');

        const now = dto.timestamp ? new Date(dto.timestamp) : new Date();
        const workHours = record.clockIn
            ? (now.getTime() - record.clockIn.getTime()) / (1000 * 60 * 60)
            : null;

        const standardHours = record.schedule
            ? this.calcStandardHours(record.schedule.startTime, record.schedule.endTime)
            : 8;
        const overtimeHours = workHours && workHours > standardHours
            ? Math.max(0, workHours - standardHours)
            : 0;

        const earlyMinutes = record.schedule
            ? this.calcEarlyMinutes(record.schedule.endTime, now)
            : null;

        return this.prisma.attendanceRecord.update({
            where: { id: dto.attendanceId },
            data: {
                clockOut: now,
                clockOutMethod: dto.method ?? ClockMethod.MANUAL,
                workHours: workHours ? Math.round(workHours * 100) / 100 : null,
                overtimeHours,
                earlyMinutes: earlyMinutes && earlyMinutes > 0 ? earlyMinutes : null,
            },
        });
    }

    /** Chấm công thủ công bởi quản lý */
    async manualRecord(dto: ManualAttendanceDto, performedById: string) {
        const date = new Date(dto.date);
        date.setHours(0, 0, 0, 0);

        const clockIn = dto.clockIn
            ? this.parseTimeToDate(date, dto.clockIn)
            : null;
        const clockOut = dto.clockOut
            ? this.parseTimeToDate(date, dto.clockOut)
            : null;

        const workHours = clockIn && clockOut
            ? (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)
            : null;

        return this.prisma.attendanceRecord.create({
            data: {
                userId: dto.userId,
                branchId: dto.branchId,
                scheduleId: dto.scheduleId ?? null,
                date,
                clockIn,
                clockOut,
                clockInMethod: ClockMethod.MANUAL,
                clockOutMethod: ClockMethod.MANUAL,
                status: AttendanceStatus.PENDING_REVIEW,
                workHours,
                note: dto.note,
                reviewedBy: performedById,
                reviewedAt: new Date(),
                reviewNote: `Chấm thủ công bởi quản lý`,
            },
        });
    }

    /** Duyệt / từ chối chấm công */
    async review(dto: ReviewAttendanceDto, reviewerId: string) {
        return this.prisma.attendanceRecord.update({
            where: { id: dto.attendanceId },
            data: {
                status: dto.status,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
                reviewNote: dto.reviewNote,
            },
        });
    }

    /** Duyệt hàng loạt */
    async bulkReview(dto: BulkReviewDto, reviewerId: string) {
        const result = await this.prisma.attendanceRecord.updateMany({
            where: { id: { in: dto.ids }, status: AttendanceStatus.PENDING_REVIEW },
            data: {
                status: dto.status,
                reviewedBy: reviewerId,
                reviewedAt: new Date(),
                reviewNote: dto.reviewNote,
            },
        });
        return { updated: result.count };
    }

    /** Lấy bảng chấm công tháng của chi nhánh */
    async getMonthlyByBranch(branchId: string, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        return this.prisma.attendanceRecord.findMany({
            where: { branchId, date: { gte: startDate, lte: endDate } },
            include: {
                user: { select: { id: true, fullName: true, staffCode: true, avatar: true } },
                schedule: true,
                leaveRequest: { select: { leaveType: true, status: true } },
            },
            orderBy: [{ date: 'asc' }, { user: { fullName: 'asc' } }],
        });
    }

    /** Lấy chấm công của 1 nhân viên */
    async getByUser(userId: string, year: number, month: number) {
        const startDate = new Date(year, month - 1, 1);
        const endDate = new Date(year, month, 0, 23, 59, 59);

        return this.prisma.attendanceRecord.findMany({
            where: { userId, date: { gte: startDate, lte: endDate } },
            include: { schedule: true },
            orderBy: { date: 'asc' },
        });
    }

    /** Lấy danh sách chờ duyệt */
    async getPending(branchId: string) {
        return this.prisma.attendanceRecord.findMany({
            where: { branchId, status: AttendanceStatus.PENDING_REVIEW },
            include: {
                user: { select: { id: true, fullName: true, staffCode: true, avatar: true } },
                schedule: true,
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    // ─── Private helpers ───────────────────────────────────────

    private determineStatus(dto: ClockInDto, schedule: any, now: Date): AttendanceStatus {
        const faceOk = (dto.faceConfidence ?? 0) >= AUTO_APPROVE_FACE_THRESHOLD;
        const hasSchedule = !!schedule;
        const onTime = hasSchedule ? this.calcLateMinutes(schedule.startTime, now) <= LATE_GRACE_MINUTES : false;

        if (faceOk && hasSchedule && onTime) return AttendanceStatus.AUTO_APPROVED;
        return AttendanceStatus.PENDING_REVIEW;
    }

    private calcLateMinutes(startTime: string, clockIn: Date): number {
        const parts = startTime.split(':');
        const h = Number(parts[0]) || 0;
        const m = Number(parts[1]) || 0;
        const scheduled = new Date(clockIn);
        scheduled.setHours(h, m, 0, 0);
        return Math.max(0, Math.floor((clockIn.getTime() - scheduled.getTime()) / 60000));
    }

    private calcEarlyMinutes(endTime: string, clockOut: Date): number {
        const parts = endTime.split(':');
        const h = Number(parts[0]) || 0;
        const m = Number(parts[1]) || 0;
        const scheduled = new Date(clockOut);
        scheduled.setHours(h, m, 0, 0);
        return Math.max(0, Math.floor((scheduled.getTime() - clockOut.getTime()) / 60000));
    }

    private calcStandardHours(startTime: string, endTime: string): number {
        const p1 = startTime.split(':');
        const sh = Number(p1[0]) || 0;
        const sm = Number(p1[1]) || 0;
        const p2 = endTime.split(':');
        const eh = Number(p2[0]) || 0;
        const em = Number(p2[1]) || 0;
        return (eh * 60 + em - sh * 60 - sm) / 60;
    }

    private parseTimeToDate(date: Date, time: string): Date {
        const parts = time.split(':');
        const h = Number(parts[0]) || 0;
        const m = Number(parts[1]) || 0;
        const d = new Date(date);
        d.setHours(h, m, 0, 0);
        return d;
    }
}
