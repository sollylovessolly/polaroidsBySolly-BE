import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ResourceCategory } from '../../generated/prisma/enums';
import {
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateResourceDto {
  @ApiProperty({
    example: 'Polaroid Film',
    description: 'Display name of the resource',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    example: 'FILM-POLAROID-STD',
    description: 'Unique stock keeping unit',
  })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku!: string;

  @ApiProperty({
    enum: ResourceCategory,
    example: ResourceCategory.MATERIAL,
  })
  @IsEnum(ResourceCategory)
  category!: ResourceCategory;

  @ApiProperty({
    example: 'SHEET',
    description: 'Smallest useful unit for this resource',
  })
  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit!: string;

  @ApiPropertyOptional({
    example: 100,
    default: 0,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @ApiPropertyOptional({
    example: 250,
    default: 0,
    description: 'Average cost paid per unit',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  averageUnitCost?: number;

  @ApiPropertyOptional({
    example: 20,
    default: 0,
    description: 'Threshold below which stock is considered low',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @ApiPropertyOptional({
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
