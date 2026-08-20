import { PartialType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';

import { CreateDeliveryRateDto } from './create-delivery-rate.dto';

export class UpdateDeliveryRateDto extends PartialType(CreateDeliveryRateDto) {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
