import { IsString, IsOptional, IsNumber, Min, Max, IsEnum } from 'class-validator';
import { ClockMethod, AttendanceStatus } from '@petshop/database';

export class ClockInDto {
    @IsString()
    userId: string;

    @IsString()
    branchId: string;

    /** ISO timestamp of clock-in (defaults to now) */
    @IsOptional()
    @IsString()
    timestamp?: string;

    @IsOptional()
    @IsEnum(ClockMethod)
    method?: ClockMethod;

    /** Face recognition confidence score 0-1 */
    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    faceConfidence?: number;

    @IsOptional()
    @IsString()
    note?: string;
}

export class ClockOutDto {
    @IsString()
    attendanceId: string;

    @IsOptional()
    @IsString()
    timestamp?: string;

    @IsOptional()
    @IsEnum(ClockMethod)
    method?: ClockMethod;

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(1)
    faceConfidence?: number;

    @IsOptional()
    @IsString()
    note?: string;
}

export class ManualAttendanceDto {
    @IsString()
    userId: string;

    @IsString()
    branchId: string;

    @IsString()
    date: string; // "2025-04-16"

    @IsOptional()
    @IsString()
    clockIn?: string; // "08:05"

    @IsOptional()
    @IsString()
    clockOut?: string; // "17:10"

    @IsOptional()
    @IsString()
    scheduleId?: string;

    @IsOptional()
    @IsString()
    note?: string;
}

export class ReviewAttendanceDto {
    @IsString()
    attendanceId: string;

    @IsEnum(AttendanceStatus)
    status: AttendanceStatus;

    @IsOptional()
    @IsString()
    reviewNote?: string;
}

export class BulkReviewDto {
    ids: string[];

    @IsEnum(AttendanceStatus)
    status: AttendanceStatus;

    @IsOptional()
    @IsString()
    reviewNote?: string;
}
