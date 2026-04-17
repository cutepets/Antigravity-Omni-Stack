import {
    IsArray,
    IsIn,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ReturnItemDto {
    @IsString()
    orderItemId!: string;

    @IsNumber()
    @Min(0.01)
    quantity!: number;

    @IsString()
    @IsIn(['EXCHANGE', 'RETURN'])
    action!: string;

    @IsString()
    @IsOptional()
    reason?: string;
}

export class CreateReturnRequestDto {
    @IsString()
    @IsIn(['PARTIAL', 'FULL'])
    type!: string;

    @IsString()
    @IsOptional()
    reason?: string;

    @IsNumber()
    @IsOptional()
    @Min(0)
    refundAmount?: number;

    @IsString()
    @IsOptional()
    refundMethod?: string;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ReturnItemDto)
    items!: ReturnItemDto[];
}
