import { Module } from '@nestjs/common';

import { CustomersModule } from '../customers/customers.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TrackingController } from './tracking.controller';
import { TrackingService } from './tracking.service';

@Module({
  imports: [PrismaModule, CustomersModule],
  controllers: [TrackingController],
  providers: [TrackingService],
})
export class TrackingModule {}
