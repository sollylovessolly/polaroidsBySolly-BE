import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { PrismaModule } from '../prisma/prisma.module';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminTokenService } from './admin-token.service';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

@Module({
  imports: [PrismaModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    AdminTokenService,
    { provide: APP_GUARD, useClass: AdminAuthGuard },
  ],
  exports: [PasswordService],
})
export class AuthModule {}
