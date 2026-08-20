import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { DeliveryRatesController } from './delivery-rates.controller';
import { DeliveryRatesService } from './delivery-rates.service';

@Module({
  imports: [PrismaModule],
  controllers: [DeliveryRatesController],
  providers: [DeliveryRatesService],
  exports: [DeliveryRatesService],
})
export class DeliveryRatesModule {}
