import { Type } from 'class-transformer';
import {
  ArrayMinSize,
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
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

import { OrderSource } from '../../generated/prisma/enums';

class CustomerDto {
  @ApiProperty({
    example: 'Jane Doe',
  })
  @IsString()
  name!: string;

  @ApiProperty({
    example: '08012345678',
  })
  @IsString()
  phone!: string;

  @ApiPropertyOptional({
    example: 'jane@example.com',
  })
  @IsOptional()
  @IsEmail()
  email?: string;
}

class DeliveryDto {
  @ApiProperty({
    example: 'Lagos',
  })
  @IsString()
  state!: string;

  @ApiProperty({
    example: '12 Marina Road, Victoria Island',
  })
  @IsString()
  address!: string;
}

class OrderItemDto {
  @ApiProperty({
    description: 'Stable product variant SKU',
    example: 'POLAROID-STANDARD',
  })
  @IsString()
  variantSku!: string;

  @ApiProperty({
    example: 2,
    minimum: 1,
  })
  @IsInt()
  @Min(1)
  quantity!: number;

  @ApiPropertyOptional({
    description:
      'Product-dependent fulfillment data: Polaroid finalPngUrl/previewUrl, Photostrip finalPngUrl, Vintage Letter finalPdfUrl, or Phone Case package',
    example: {
      finalPngUrl: 'https://example.com/final.png',
      previewUrl: 'https://example.com/preview.png',
    },
  })
  @IsOptional()
  @IsObject()
  customization?: Record<string, unknown>;
}

class ShipmentSelectionDto {
  @ApiProperty({ description: 'Opaque token returned by Shipbubble Rates API' })
  @IsString()
  requestToken!: string;
  @ApiProperty() @IsString() serviceCode!: string;
  @ApiProperty() @IsString() courierId!: string;
}

export class CreateOrderDto {
  @ApiPropertyOptional({ example: 'WELCOME10' })
  @IsOptional()
  @IsString()
  discountCode?: string;

  @ApiPropertyOptional({ type: ShipmentSelectionDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => ShipmentSelectionDto)
  shipment?: ShipmentSelectionDto;

  @ApiProperty({
    type: CustomerDto,
  })
  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @ApiProperty({
    type: DeliveryDto,
  })
  @ValidateNested()
  @Type(() => DeliveryDto)
  delivery!: DeliveryDto;

  @ApiProperty({
    enum: OrderSource,
    example: OrderSource.WEBSITE,
  })
  @IsEnum(OrderSource)
  source!: OrderSource;

  @ApiPropertyOptional({
    example: 'Please deliver before 5pm',
  })
  @IsOptional()
  @IsString()
  customerNote?: string;

  @ApiProperty({
    type: [OrderItemDto],
    example: [
      {
        variantSku: 'POLAROID-STANDARD',
        quantity: 2,
        customization: {
          finalPngUrl: 'https://storage.example/polaroids.png',
          previewUrl: 'https://storage.example/polaroids-preview.png',
        },
      },
      {
        variantSku: 'VINTAGE-AMBER-BURNT',
        quantity: 1,
        customization: {
          finalPdfUrl: 'https://storage.example/letter.pdf',
        },
      },
      {
        variantSku: 'PHONECASE-IPHONE-15-PRO',
        quantity: 1,
        customization: { package: 'WITH_POLAROID' },
      },
    ],
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({
    each: true,
  })
  @Type(() => OrderItemDto)
  items!: OrderItemDto[];
}
