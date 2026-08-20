import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDate, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateOwnerWithdrawalDto {
  @ApiProperty({ example: 100000 })
  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0.01)
  amount!: number;

  @ApiPropertyOptional({ example: 'August personal withdrawal' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ example: '2026-08-31T12:00:00.000Z' })
  @IsOptional()
  @Type(() => Date)
  @IsDate()
  withdrawnAt?: Date;
}
