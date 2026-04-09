import { IsString, IsOptional, IsEnum, IsNumber, IsDateString } from 'class-validator'
import { GroomingStatus } from '@petshop/database'

export class CreateGroomingDto {
  @IsString()
  petId!: string

  @IsString()
  @IsOptional()
  branchId?: string

  @IsString()
  @IsOptional()
  staffId?: string

  @IsString()
  @IsOptional()
  serviceId?: string

  @IsDateString()
  @IsOptional()
  startTime?: string

  @IsString()
  @IsOptional()
  notes?: string
}

export class UpdateGroomingDto {
  @IsEnum(GroomingStatus)
  @IsOptional()
  status?: GroomingStatus

  @IsString()
  @IsOptional()
  branchId?: string

  @IsString()
  @IsOptional()
  staffId?: string

  @IsDateString()
  @IsOptional()
  startTime?: string

  @IsDateString()
  @IsOptional()
  endTime?: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsNumber()
  @IsOptional()
  price?: number
}
