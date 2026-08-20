import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { ResourcesModule } from '../resources/resources.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
@Module({
  imports: [PrismaModule, ResourcesModule],
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
