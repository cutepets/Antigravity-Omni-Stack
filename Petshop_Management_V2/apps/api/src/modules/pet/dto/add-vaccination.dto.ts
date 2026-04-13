import { IsDateString, IsNotEmpty, IsOptional, IsString } from 'class-validator'

export class AddVaccinationDto {
  @IsString()
  @IsNotEmpty()
  vaccineName!: string

  @IsDateString()
  @IsNotEmpty()
  date!: string

  @IsDateString()
  @IsOptional()
  nextDueDate?: string

  @IsString()
  @IsOptional()
  notes?: string

  @IsString()
  @IsOptional()
  photoUrl?: string
}
