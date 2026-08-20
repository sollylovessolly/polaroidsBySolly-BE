import { Module } from '@nestjs/common';

import { PhoneNumberService } from './phone-number.service';
import { PrismaModule } from '../prisma/prisma.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [PrismaModule],
  controllers: [CustomersController],
  providers: [PhoneNumberService, CustomersService],
  exports: [PhoneNumberService],
})
export class CustomersModule {}
