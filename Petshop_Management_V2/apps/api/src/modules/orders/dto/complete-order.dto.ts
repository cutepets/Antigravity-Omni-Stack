import { IsOptional, IsBoolean } from 'class-validator';

export class CompleteOrderDto {
  @IsBoolean()
  @IsOptional()
  forceComplete?: boolean;
}
