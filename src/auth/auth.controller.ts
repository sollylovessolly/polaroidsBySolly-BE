import { Body, Controller, Get, Post, Req } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import { AuthService } from './auth.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from './public.decorator';
import { RateLimit } from '../security/rate-limit.decorator';

@ApiTags('Admin Auth')
@Controller('auth/admin')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('login')
  @RateLimit('LOGIN_RATE_LIMIT_PER_MINUTE', 5)
  @ApiOperation({ summary: 'Authenticate the owner/admin' })
  login(@Body() dto: AdminLoginDto) {
    return this.auth.login(dto);
  }

  @Get('me')
  me(@Req() request: Request & { admin: { id: string } }) {
    return this.auth.me(request.admin.id);
  }
}
