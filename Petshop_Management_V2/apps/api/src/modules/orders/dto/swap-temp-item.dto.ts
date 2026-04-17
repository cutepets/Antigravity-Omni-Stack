import { IsString, IsNotEmpty } from 'class-validator';

export class SwapTempItemDto {
    @IsString()
    @IsNotEmpty()
    realProductId!: string;

    @IsString()
    @IsNotEmpty()
    realProductVariantId!: string;
}
