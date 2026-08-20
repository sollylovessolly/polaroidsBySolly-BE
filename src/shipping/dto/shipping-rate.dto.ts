import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

class ShippingRateItemDto {
  @IsString() variantSku!: string;
  @Type(() => Number) @IsInt() @Min(1) quantity!: number;
}

export class ShippingRateDto {
  @IsString() name!: string;
  @IsEmail() email!: string;
  @IsString() phone!: string;
  @IsString() address!: string;
  @IsString() state!: string;
  @IsOptional() @IsDateString() pickupDate?: string;
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ShippingRateItemDto)
  items!: ShippingRateItemDto[];
}
