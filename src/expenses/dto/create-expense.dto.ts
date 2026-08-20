import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDate,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

import { ExpenseCategory } from '../../generated/prisma/client';

export class CreateExpenseDto {
  @ApiProperty({ example: 'August Internet' })
  @IsString()
  title!: string;

  @ApiPropertyOptional({ example: 'Monthly data subscription' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: ExpenseCategory, example: ExpenseCategory.DATA })
  @IsEnum(ExpenseCategory)
  category!: ExpenseCategory;

  @ApiProperty({ example: 15000, minimum: 0.01 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount!: number;

  @ApiProperty({ example: '2026-08-05T10:00:00.000Z' })
  @Type(() => Date)
  @IsDate()
  expenseDate!: Date;

  @ApiPropertyOptional({ example: 'cm123orderid' })
  @IsOptional()
  @IsString()
  relatedOrderId?: string;
}
