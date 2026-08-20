import {
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';

import { RATE_LIMIT_KEY, RateLimitOptions } from './rate-limit.decorator';

@Injectable()
export class RateLimitGuard implements CanActivate {
  private readonly buckets = new Map<
    string,
    { count: number; resetAt: number }
  >();

  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext) {
    const options = this.reflector.getAllAndOverride<RateLimitOptions>(
      RATE_LIMIT_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!options) return true;
    const request = context.switchToHttp().getRequest<Request>();
    const limit = this.positiveInt(
      this.config.get(options.env),
      options.fallback,
    );
    const now = Date.now();
    const ip = request.ip || request.socket.remoteAddress || 'unknown';
    const key = `${context.getClass().name}:${context.getHandler().name}:${ip}`;
    const bucket = this.buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      this.buckets.set(key, { count: 1, resetAt: now + 60_000 });
      this.prune(now);
      return true;
    }
    if (bucket.count >= limit) {
      throw new HttpException(
        'Too many requests. Please try again shortly.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    bucket.count += 1;
    return true;
  }

  private positiveInt(value: unknown, fallback: number) {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  private prune(now: number) {
    if (this.buckets.size < 1_000) return;
    for (const [key, value] of this.buckets)
      if (value.resetAt <= now) this.buckets.delete(key);
  }
}
