import { IsString, IsNotEmpty, IsOptional, IsNumber, IsDateString, IsIn, IsBoolean } from 'class-validator'
import { PetGender } from '@petshop/shared'

export class CreatePetDto {
  @IsString()
  @IsNotEmpty()
  name!: string

  @IsString()
  @IsNotEmpty()
  species!: string

  @IsString()
  @IsOptional()
  breed?: string

  @IsIn(['MALE', 'FEMALE', 'UNKNOWN'])
  @IsOptional()
  gender?: PetGender

  @IsDateString()
  @IsOptional()
  dateOfBirth?: string

  @IsNumber()
  @IsOptional()
  weight?: number

  @IsString()
  @IsOptional()
  color?: string

  @IsString()
  @IsOptional()
  microchipId?: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsString()
  @IsNotEmpty()
  customerId!: string

  @IsString()
  @IsOptional()
  allergies?: string

  @IsString()
  @IsOptional()
  temperament?: string

  @IsBoolean()
  @IsOptional()
  isActive?: boolean

  @IsString()
  @IsOptional()
  avatar?: string
}
