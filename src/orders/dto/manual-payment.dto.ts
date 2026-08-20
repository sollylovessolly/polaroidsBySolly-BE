import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { PaymentMethod } from '../../generated/prisma/client';

export class ManualPaymentDto {
  @ApiProperty({
    enum: [PaymentMethod.TRANSFER, PaymentMethod.OPAY],
    example: PaymentMethod.TRANSFER,
  })
  @IsIn([PaymentMethod.TRANSFER, PaymentMethod.OPAY])
  method!: PaymentMethod;

  @ApiPropertyOptional({ example: 'TRANSFER-2026-001' })
  @IsOptional()
  @IsString()
  reference?: string;
}
