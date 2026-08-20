import { Module } from '@nestjs/common';

import { InventoryModule } from '../inventory/inventory.module';
import { DeliveryRatesModule } from '../delivery-rates/delivery-rates.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PaymentsModule } from '../payments/payments.module';
import { CustomersModule } from '../customers/customers.module';
import { DiscountsModule } from '../discounts/discounts.module';
import { ShippingModule } from '../shipping/shipping.module';
import { OrdersController } from './orders.controller';
import { OrderCustomizationService } from './order-customization.service';
import { OrdersService } from './orders.service';

@Module({
  imports: [
    PrismaModule,
    InventoryModule,
    DeliveryRatesModule,
    PaymentsModule,
    CustomersModule,
    DiscountsModule,
    ShippingModule,
  ],
  controllers: [OrdersController],
  providers: [OrdersService, OrderCustomizationService],
})
export class OrdersModule {}
