import { IsString, IsEnum, IsOptional, IsNumber, Min } from 'class-validator';
import { LeaveType } from '@petshop/database';

export class CreateLeaveDto {
    @IsString()
    userId: string;

    @IsString()
    branchId: string;

    @IsEnum(LeaveType)
    leaveType: LeaveType;

    @IsString()
    startDate: string; // ISO date

    @IsString()
    endDate: string; // ISO date

    @IsNumber()
    @Min(0.5)
    totalDays: number;

    @IsString()
    reason: string;

    @IsOptional()
    @IsString()
    attachmentUrl?: string;
}

export class ApproveLeaveDto {
    @IsString()
    leaveId: string;

    /** 'APPROVED' | 'REJECTED' */
    @IsString()
    action: 'APPROVED' | 'REJECTED';

    @IsOptional()
    @IsString()
    rejectedReason?: string;
}
