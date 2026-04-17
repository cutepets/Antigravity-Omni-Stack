import { IsString, IsNumber, IsOptional, Min, Max } from 'class-validator';

export class CreatePayrollPeriodDto {
    @IsString()
    branchId: string;

    @IsNumber()
    @Min(1)
    @Max(12)
    month: number;

    @IsNumber()
    year: number;

    @IsOptional()
    @IsString()
    note?: string;
}

export class CalculatePayrollDto {
    @IsString()
    periodId: string;

    /** If omitted, calculates for all users in branch */
    @IsOptional()
    userIds?: string[];

    /** Meal allowance per day (default 0) */
    @IsOptional()
    @IsNumber()
    mealAllowancePerDay?: number;

    /** Transport allowance per day (default 0) */
    @IsOptional()
    @IsNumber()
    transportAllowancePerDay?: number;

    /** OT multiplier (default 1.5) */
    @IsOptional()
    @IsNumber()
    overtimeMultiplier?: number;

    /** Late deduction per minute in VND (default 0) */
    @IsOptional()
    @IsNumber()
    lateDeductionPerMinute?: number;
}

export class UpdateSlipDto {
    @IsOptional()
    @IsNumber()
    mealAllowance?: number;

    @IsOptional()
    @IsNumber()
    transportAllowance?: number;

    @IsOptional()
    @IsNumber()
    performanceBonus?: number;

    @IsOptional()
    @IsNumber()
    otherAllowances?: number;

    @IsOptional()
    @IsNumber()
    otherDeductions?: number;

    @IsOptional()
    @IsString()
    note?: string;
}
