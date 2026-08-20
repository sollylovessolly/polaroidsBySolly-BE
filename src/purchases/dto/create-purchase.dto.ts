import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PurchaseItemDto {
  @ApiProperty({
    description: 'ID of the resource being purchased',
    example: 'cmrwr5resource0001',
  })
  @IsString()
  resourceId!: string;

  @ApiProperty({
    description: 'How many purchase units were bought (e.g. 3 packs)',
    example: 3,
    minimum: 0.01,
  })
  @IsNumber()
  @Min(0.01)
  purchaseQuantity!: number;

  @ApiProperty({
    description: 'The unit the resource was bought in (e.g. PACK, BOX)',
    example: 'PACK',
  })
  @IsString()
  @MaxLength(30)
  purchaseUnit!: string;

  @ApiPropertyOptional({
    description:
      'How many base units are in one purchase unit (e.g. 20 sheets per pack). Defaults to 1.',
    example: 20,
    default: 1,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber()
  @Min(0.01)
  unitsPerPurchaseUnit?: number;

  @ApiProperty({
    description:
      'Total amount paid for this line item (all purchase units combined)',
    example: 2700,
    minimum: 0,
  })
  @IsNumber()
  @Min(0)
  totalCost!: number;
}

export class CreatePurchaseDto {
  @ApiPropertyOptional({
    description: 'Optional supplier the purchase was made from',
    example: 'cmrwsupplier0001',
  })
  @IsOptional()
  @IsString()
  supplierId?: string;

  @ApiPropertyOptional({
    description: 'When the purchase happened. Defaults to now.',
    example: '2026-07-25T21:00:00.000Z',
  })
  @IsOptional()
  @IsDateString()
  purchasedAt?: string;

  @ApiPropertyOptional({
    description: 'Free-form note about the purchase',
    example: 'Bought 3 packs of Instax film and 2 boxes of mailers',
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;

  @ApiProperty({
    type: [PurchaseItemDto],
    description: 'The resources bought in this purchase',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PurchaseItemDto)
  items!: PurchaseItemDto[];
}
