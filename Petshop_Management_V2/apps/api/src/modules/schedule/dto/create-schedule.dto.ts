import { IsString, IsDateString, IsEnum, IsOptional } from 'class-validator';
import { ShiftType } from '@petshop/database';

export class CreateScheduleDto {
    @IsString()
    userId: string;

    @IsString()
    branchId: string;

    @IsDateString()
    date: string;

    @IsEnum(ShiftType)
    shiftType: ShiftType;

    @IsString()
    startTime: string; // "08:00"

    @IsString()
    endTime: string; // "17:00"

    @IsOptional()
    @IsString()
    note?: string;
}

export class BulkCreateScheduleDto {
    @IsString()
    branchId: string;

    /** Array of userIds */
    userIds: string[];

    /** ISO dates to schedule */
    dates: string[];

    @IsEnum(ShiftType)
    shiftType: ShiftType;

    @IsString()
    startTime: string;

    @IsString()
    endTime: string;

    @IsOptional()
    @IsString()
    note?: string;
}
