import { IsString, IsOptional, IsInt, Min, IsEnum, IsIn } from 'class-validator'
import { Type } from 'class-transformer'
import { PetGender } from '@petshop/shared'

export class FindPetsDto {
  @IsString()
  @IsOptional()
  q?: string

  @IsString()
  @IsOptional()
  species?: string

  @IsIn(['MALE', 'FEMALE', 'UNKNOWN'])
  @IsOptional()
  gender?: PetGender

  @IsString()
  @IsOptional()
  customerId?: string

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  page?: number

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @IsOptional()
  limit?: number
}
