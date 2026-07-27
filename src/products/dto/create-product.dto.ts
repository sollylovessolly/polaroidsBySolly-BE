import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ProductCategory } from '../../generated/prisma/enums';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateProductDto {
  @ApiProperty({
    example: 'Polaroids',
    description: 'Display name of the product',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'polaroids',
    description: 'Unique URL-friendly identifier',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  slug!: string;

  @ApiPropertyOptional({
    example: 'Custom Polaroid prints created from customer photos.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    enum: ProductCategory,
    example: ProductCategory.POLAROID,
  })
  @IsEnum(ProductCategory)
  category!: ProductCategory;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
