import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CancelOrderDto {
  @ApiProperty({ example: 'Customer requested cancellation' })
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  restoreInventory = false;
}
