import { ApiProperty } from '@nestjs/swagger'
import { IsEnum, IsNotEmpty, IsString } from 'class-validator'

export enum SyncAttributeType {
    BREED = 'breed',
    TEMPERAMENT = 'temperament',
}

export class SyncAttributeDto {
    @ApiProperty({ enum: SyncAttributeType })
    @IsEnum(SyncAttributeType)
    attribute!: SyncAttributeType

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    oldValue!: string

    @ApiProperty()
    @IsString()
    @IsNotEmpty()
    newValue!: string
}
