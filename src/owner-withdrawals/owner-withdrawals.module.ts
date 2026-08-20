import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnerWithdrawalsController } from './owner-withdrawals.controller';
import { OwnerWithdrawalsService } from './owner-withdrawals.service';
@Module({
  imports: [PrismaModule],
  controllers: [OwnerWithdrawalsController],
  providers: [OwnerWithdrawalsService],
  exports: [OwnerWithdrawalsService],
})
export class OwnerWithdrawalsModule {}
