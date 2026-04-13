import { Type } from 'class-transformer'
import { IsDateString, IsNumber, IsOptional, IsString, Min } from 'class-validator'

export class AddWeightLogDto {
  @Type(() => Number)
  @IsNumber()
  @Min(0.1)
  weight!: number

  @IsString()
  @IsOptional()
  notes?: string

  @IsDateString()
  @IsOptional()
  date?: string
}
