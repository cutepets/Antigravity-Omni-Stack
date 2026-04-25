import {
    IsArray,
    IsBoolean,
    IsIn,
    IsNotEmpty,
    IsNumber,
    IsOptional,
    IsString,
    Min,
    ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class ExchangeOrderItemDto {
    @IsString()
    @IsOptional()
    productId?: string;

    @IsString()
    @IsOptional()
    productVariantId?: string;

    @IsString()
    @IsOptional()
    sku?: string;

    @IsString()
    @IsNotEmpty()
    description!: string;

    @IsNumber()
    @Min(0.01)
    quantity!: number;

    @IsNumber()
    @Min(0)
    unitPrice!: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    discountItem?: number;

    @IsNumber()
    @IsOptional()
    @Min(0)
    vatRate?: number;

    @IsString()
    @IsIn(['product'])
    type!: string;

    @IsBoolean()
    @IsOptional()
    isTemp?: boolean;

    @IsString()
    @IsOptional()
    tempLabel?: string;
}

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

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => ExchangeOrderItemDto)
    @IsOptional()
    exchangeItems?: ExchangeOrderItemDto[];
}
