import { IsOptional, IsString, ValidateNested, IsArray, IsNumber, Min } from 'class-validator';
import { Type } from 'class-transformer';
import {
  CreateOrderDto,
  CreateOrderItemDto,
} from './create-order.dto.js';

export class UpdateOrderItemDto extends CreateOrderItemDto {
  @IsString()
  @IsOptional()
  id?: string;
}

export class UpdateOrderDto extends CreateOrderDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => UpdateOrderItemDto)
  declare items: UpdateOrderItemDto[];

  @IsNumber()
  @IsOptional()
  @Min(0)
  paidAmount?: number;
}
