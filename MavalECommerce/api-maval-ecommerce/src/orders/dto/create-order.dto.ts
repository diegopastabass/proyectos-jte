import {
  IsUUID,
  IsInt,
  Min,
  IsArray,
  ValidateNested,
  ArrayMinSize,
  IsString,
  IsOptional,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CreateCustomerDto } from '../../customers/dto/create-customer.dto';

export class CreateOrderItemDto {
  @IsUUID()
  publicationId: string;

  @IsInt()
  @Min(1)
  quantity: number;
}

export class CreateOrderDto {
  @ValidateNested()
  @Type(() => CreateCustomerDto)
  customer: CreateCustomerDto;

  @IsArray()
  @ValidateNested({ each: true })
  @ArrayMinSize(1)
  @Type(() => CreateOrderItemDto)
  items: CreateOrderItemDto[];

  @IsOptional()
  @IsString()
  customerNotes?: string;
}
