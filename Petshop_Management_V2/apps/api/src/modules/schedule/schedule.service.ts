import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { ShiftType } from '@petshop/database';
import { CreateScheduleDto, BulkCreateScheduleDto } from './dto/create-schedule.dto';

@Injectable()
export class ScheduleService {
    constructor(private prisma: DatabaseService) { }

    async create(dto: CreateScheduleDto) {
        return this.prisma.staffSchedule.upsert({
            where: {
                userId_date_shiftType: {
                    userId: dto.userId,
                    date: new Date(dto.date),
                    shiftType: dto.shiftType,
                },
            },
            update: {
                startTime: dto.startTime,
                endTime: dto.endTime,
                note: dto.note,
                isActive: true,
            },
            create: {
                userId: dto.userId,
                branchId: dto.branchId,
                date: new Date(dto.date),
                shiftType: dto.shiftType,
                startTime: dto.startTime,
                endTime: dto.endTime,
                note: dto.note,
            },
            include: { user: { select: { fullName: true, username: true } } },
        });
    }

    async bulkCreate(dto: BulkCreateScheduleDto) {
        const records: CreateScheduleDto[] = [];
        for (const userId of dto.userIds) {
            for (const date of dto.dates) {
                records.push({
                    userId,
                    branchId: dto.branchId,
                    date,
                    shiftType: dto.shiftType,
                    startTime: dto.startTime,
                    endTime: dto.endTime,
                    note: dto.note,
                });
            }
        }
        // upsert all in sequence to respect unique constraint
        const results = [];
        for (const r of records) {
            results.push(await this.create(r));
        }
        return { created: results.length, data: results };
    }

    async findByBranchAndDate(branchId: string, dateFrom: string, dateTo: string) {
        return this.prisma.staffSchedule.findMany({
            where: {
                branchId,
                date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
                isActive: true,
            },
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
            orderBy: [{ date: 'asc' }, { shiftType: 'asc' }],
        });
    }

    async findByUser(userId: string, dateFrom: string, dateTo: string) {
        return this.prisma.staffSchedule.findMany({
            where: {
                userId,
                date: { gte: new Date(dateFrom), lte: new Date(dateTo) },
                isActive: true,
            },
            orderBy: { date: 'asc' },
        });
    }

    async findAll(params: { startDate?: string; endDate?: string; userId?: string; branchId?: string }) {
        const where: any = {};
        if (params.startDate) where.date = { ...where.date, gte: new Date(params.startDate) };
        if (params.endDate) where.date = { ...where.date, lte: new Date(params.endDate) };
        if (params.userId) where.userId = params.userId;
        if (params.branchId) where.branchId = params.branchId;

        return this.prisma.staffSchedule.findMany({
            where,
            include: {
                user: { select: { id: true, fullName: true, username: true, avatar: true } },
            },
            orderBy: [{ date: 'asc' }, { shiftType: 'asc' }],
        });
    }

    async update(id: string, dto: Partial<CreateScheduleDto> & { isActive?: boolean }) {
        return this.prisma.staffSchedule.update({
            where: { id },
            data: {
                ...(dto.shiftType ? { shiftType: dto.shiftType } : {}),
                ...(dto.startTime ? { startTime: dto.startTime } : {}),
                ...(dto.endTime ? { endTime: dto.endTime } : {}),
                ...(dto.note !== undefined ? { note: dto.note } : {}),
                ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
            },
            include: { user: { select: { fullName: true, username: true } } },
        });
    }

    async delete(id: string) {
        return this.prisma.staffSchedule.update({
            where: { id },
            data: { isActive: false },
        });
    }

    async findById(id: string) {
        return this.prisma.staffSchedule.findUnique({
            where: { id },
            include: { user: { select: { fullName: true, username: true } } },
        });
    }

    /** Find today's active schedule for a user at a branch */
    async findTodaySchedule(userId: string, branchId: string, shiftType?: ShiftType) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        return this.prisma.staffSchedule.findFirst({
            where: {
                userId,
                branchId,
                date: { gte: today, lt: tomorrow },
                isActive: true,
                ...(shiftType ? { shiftType } : {}),
            },
        });
    }
}
