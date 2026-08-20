import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';

import { OrderSource } from '../../generated/prisma/client';
import { CreateOrderDto } from './create-order.dto';

export class CreateManualOrderDto extends OmitType(CreateOrderDto, [
  'source',
] as const) {
  @ApiProperty({
    enum: [OrderSource.WHATSAPP, OrderSource.INSTAGRAM, OrderSource.MANUAL],
    example: OrderSource.WHATSAPP,
  })
  @IsIn([OrderSource.WHATSAPP, OrderSource.INSTAGRAM, OrderSource.MANUAL])
  source!: OrderSource;

  @ApiPropertyOptional({ example: 'Received through WhatsApp' })
  @IsOptional()
  @IsString()
  adminNote?: string;
}
