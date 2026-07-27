import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

import { OrderSource } from '../../generated/prisma/enums';

class CustomerDto {
  @ApiProperty({ example: 'Jane Doe' })
  @IsString()
  name!: string;

  @ApiProperty({ example: '08012345678' })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({ example: 'jane@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;
}

class DeliveryDto {
  @ApiProperty({ example: 'Lagos' })
  @IsString()
  state!: string;

  @ApiProperty({ example: '12 Marina Road, Victoria Island' })
  @IsString()
  address!: string;
}

class OrderItemDto {
  @ApiProperty({ example: 'VARIANT_ID_HERE' })
  @IsString()
  variantId!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description: 'Product-specific customization details',
    example: { imageUrl: 'https://...', note: 'Matte finish' },
  })
  @IsOptional()
  @IsObject()
  customization?: Record<string, unknown>;
}

export class CreateOrderDto {
  @ApiProperty({ type: CustomerDto })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({ type: DeliveryDto })
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @ApiProperty({
    enum: OrderSource,
    example: OrderSource.WEBSITE,
  })
  @IsEnum(OrderSource)
  source!: OrderSource;

  @ApiPropertyOptional({ example: 'Please deliver before 5pm' })
  @IsOptional()
  @IsString()
  customerNote?: string;

  @ApiProperty({ type: [OrderItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
