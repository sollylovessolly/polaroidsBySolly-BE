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
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku: string;

  @IsEnum(ResourceCategory)
  category: ResourceCategory;

  @IsString()
  @MinLength(1)
  @MaxLength(30)
  unit: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentStock?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  averageUnitCost?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  lowStockThreshold?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}