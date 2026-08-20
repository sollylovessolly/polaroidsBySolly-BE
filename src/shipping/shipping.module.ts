import { Module } from '@nestjs/common';
import { ShipbubbleService } from './shipbubble.service';
import { ShippingService } from './shipping.service';
import { ShippingController } from './shipping.controller';

@Module({
  controllers: [ShippingController],
  providers: [ShipbubbleService, ShippingService],
  exports: [ShipbubbleService, ShippingService],
})
export class ShippingModule {}
