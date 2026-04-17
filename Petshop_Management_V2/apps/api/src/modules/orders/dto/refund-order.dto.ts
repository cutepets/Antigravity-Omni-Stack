import { IsIn, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefundOrderDto {
    @IsString()
    @IsNotEmpty()
    @IsIn(['PARTIALLY_REFUNDED', 'FULLY_REFUNDED'])
    status!: string;

    @IsString()
    @IsOptional()
    reason?: string;
}
