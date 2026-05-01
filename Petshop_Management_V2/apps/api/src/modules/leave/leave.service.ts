import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { LeaveStatus } from '@petshop/database';
import { CreateLeaveDto, ApproveLeaveDto } from './dto/leave.dto';

@Injectable()
export class LeaveService {
    constructor(private prisma: DatabaseService) { }

    async create(dto: CreateLeaveDto) {
        const startDate = new Date(dto.startDate);
        const endDate = new Date(dto.endDate);

        if (endDate < startDate) {
            throw new BadRequestException('Ngày kết thúc phải sau ngày bắt đầu.');
        }

        return this.prisma.leaveRequest.create({
            data: {
                userId: dto.userId,
                branchId: dto.branchId,
                leaveType: dto.leaveType,
                startDate,
                endDate,
                totalDays: dto.totalDays,
                reason: dto.reason,
                attachmentUrl: dto.attachmentUrl,
                status: LeaveStatus.PENDING,
            },
            include: {
                user: { select: { fullName: true, username: true, email: true } },
            },
        });
    }

    async approve(dto: ApproveLeaveDto, approverId: string) {
        const leave = await this.prisma.leaveRequest.findUnique({
            where: { id: dto.leaveId },
        });
        if (!leave) throw new NotFoundException('Không tìm thấy đơn xin phép.');
        if (leave.status !== LeaveStatus.PENDING) {
            throw new BadRequestException('Đơn xin phép đã được xử lý rồi.');
        }

        const status = dto.action === 'APPROVED' ? LeaveStatus.APPROVED : LeaveStatus.REJECTED;

        const updated = await this.prisma.leaveRequest.update({
            where: { id: dto.leaveId },
            data: {
                status,
                approvedBy: approverId,
                approvedAt: new Date(),
                rejectedReason: dto.rejectedReason,
            },
        });

        // Nếu duyệt → tạo attendance records ON_LEAVE cho từng ngày
        if (status === LeaveStatus.APPROVED) {
            await this.createLeaveAttendanceRecords(updated);
        }

        return updated;
    }

    async cancel(leaveId: string, userId: string) {
        const leave = await this.prisma.leaveRequest.findUnique({
            where: { id: leaveId },
        });
        if (!leave) throw new NotFoundException('Không tìm thấy đơn.');
        if (leave.userId !== userId) throw new BadRequestException('Không có quyền hủy đơn này.');
        if (leave.status !== LeaveStatus.PENDING) {
            throw new BadRequestException('Chỉ hủy được đơn đang chờ duyệt.');
        }

        return this.prisma.leaveRequest.update({
            where: { id: leaveId },
            data: { status: LeaveStatus.CANCELLED },
        });
    }

    async list(query: any) {
        const page = parseInt(query.page || '1');
        const limit = parseInt(query.limit || '15');
        const skip = (page - 1) * limit;

        const where: any = {};
        if (query.status) where.status = query.status;
        if (query.branchId) where.branchId = query.branchId;
        if (query.userId) where.userId = query.userId;

        const [data, total] = await Promise.all([
            this.prisma.leaveRequest.findMany({
                where, skip, take: limit,
                include: {
                    user: { select: { id: true, fullName: true, username: true, avatar: true } },
                    approver: { select: { fullName: true } },
                },
                orderBy: { createdAt: 'desc' },
            }),
            this.prisma.leaveRequest.count({ where }),
        ]);

        return { data, total, page, limit, totalPages: Math.ceil(total / limit) };
    }

    async getByBranch(branchId: string, status?: LeaveStatus) {
        return this.prisma.leaveRequest.findMany({
            where: { branchId, ...(status ? { status } : {}) },
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
                approver: { select: { fullName: true } },
            },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getByUser(userId: string) {
        return this.prisma.leaveRequest.findMany({
            where: { userId },
            include: { approver: { select: { fullName: true } } },
            orderBy: { createdAt: 'desc' },
        });
    }

    async getLeaveBalance(userId: string, year: number) {
        const annualTotal = 12; // 12 ngày phép/năm theo luật
        const approvedLeaves = await this.prisma.leaveRequest.aggregate({
            where: {
                userId,
                status: LeaveStatus.APPROVED,
                leaveType: 'ANNUAL',
                startDate: { gte: new Date(`${year}-01-01`) },
                endDate: { lte: new Date(`${year}-12-31`) },
            },
            _sum: { totalDays: true },
        });
        const used = approvedLeaves._sum.totalDays ?? 0;
        return {
            year,
            annualTotal,
            used,
            remaining: annualTotal - used,
        };
    }

    // Tạo attendance records ON_LEAVE sau khi duyệt đơn
    private async createLeaveAttendanceRecords(leave: any) {
        const records = [];
        const current = new Date(leave.startDate);
        const end = new Date(leave.endDate);

        while (current <= end) {
            const dayDate = new Date(current);
            dayDate.setHours(0, 0, 0, 0);
            const dow = dayDate.getDay();
            if (dow !== 0 && dow !== 6) { // Bỏ qua Chủ nhật & Thứ 7
                records.push({
                    userId: leave.userId,
                    branchId: leave.branchId,
                    date: dayDate,
                    status: 'ON_LEAVE' as const,
                    isLeave: true,
                    leaveRequestId: leave.id,
                    workHours: 8,
                });
            }
            current.setDate(current.getDate() + 1);
        }

        if (records.length > 0) {
            await this.prisma.attendanceRecord.createMany({
                data: records,
                skipDuplicates: true,
            });
        }
    }
}
