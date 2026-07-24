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
  @IsString()
  productId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  sku: string;

  @IsInt()
  @Min(0)
  sellingPrice: number;

  @IsOptional()
  @IsBoolean()
  tracksStock?: boolean;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  outsourcedUnitCost?: number;

  @IsOptional()
  @IsString()
  supplierId?: string;
}