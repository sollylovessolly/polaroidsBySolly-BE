import { SetMetadata } from '@nestjs/common';

export const RATE_LIMIT_KEY = 'rateLimit';
export type RateLimitOptions = { env: string; fallback: number };
export const RateLimit = (env: string, fallback: number) =>
  SetMetadata(RATE_LIMIT_KEY, { env, fallback } satisfies RateLimitOptions);
