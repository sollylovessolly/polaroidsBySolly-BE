import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { ConsumptionRule } from '../../generated/prisma/enums';

export class CreateResourceRuleDto {
  @ApiProperty({
    example: 'VARIANT_ID_HERE',
    description: 'The product variant that consumes the resource',
  })
  @IsString()
  variantId!: string;

  @ApiProperty({
    example: 'RESOURCE_ID_HERE',
    description: 'The physical resource consumed by the variant',
  })
  @IsString()
  resourceId!: string;

  @ApiProperty({
    enum: ConsumptionRule,
    example: ConsumptionRule.PER_UNIT,
  })
  @IsEnum(ConsumptionRule)
  rule!: ConsumptionRule;

  @ApiProperty({
    example: 1,
    description: 'Number of resource units consumed',
  })
  @IsNumber()
  @Min(0.01)
  quantity!: number;

  @ApiPropertyOptional({
    example: 20,
    description:
      'Required for CAPACITY rules, such as one box per 20 Polaroids',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  capacity?: number;

  @ApiPropertyOptional({
    example: 'POLAROID_PRINT',
    description: 'Groups related usage together before calculating capacity',
  })
  @IsOptional()
  @IsString()
  usageGroup?: string;
}
