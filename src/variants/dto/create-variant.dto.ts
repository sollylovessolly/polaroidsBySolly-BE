import {
  ApiProperty,
  ApiPropertyOptional,
} from '@nestjs/swagger';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateVariantDto {
  @ApiProperty({
    example: 'PRODUCT_ID_HERE',
    description: 'The product this variant belongs to',
  })
  @IsString()
  productId!: string;

  @ApiProperty({
    example: 'iPhone 15 Pro',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'PHONECASE-IP15-PRO',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku!: string;

  @ApiProperty({
    example: 5500,
    description: 'Selling price in naira',
  })
  @IsInt()
  @Min(0)
  sellingPrice!: number;

  @ApiPropertyOptional({
    example: true,
    default: false,
    description:
      'Whether availability depends on physical inventory',
  })
  @IsOptional()
  @IsBoolean()
  tracksStock?: boolean;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: 1200,
    default: 0,
    description:
      'Cost paid to an external vendor for one unit',
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  outsourcedUnitCost?: number;

  @ApiPropertyOptional({
    example: 'SUPPLIER_ID_HERE',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;
}