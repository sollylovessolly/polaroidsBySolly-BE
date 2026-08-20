import { Module } from '@nestjs/common';

import { PrismaModule } from '../prisma/prisma.module';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { InventoryService } from './inventory.service';

@Module({
  imports: [PrismaModule],

  providers: [InventoryService, InventoryAvailabilityService],

  exports: [InventoryService, InventoryAvailabilityService],
})
export class InventoryModule {}
