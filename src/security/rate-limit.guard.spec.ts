import { ExecutionContext, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { RateLimitGuard } from './rate-limit.guard';

describe('RateLimitGuard', () => {
  it('throttles a decorated endpoint after its configured per-minute limit', () => {
    const reflector = {
      getAllAndOverride: jest
        .fn()
        .mockReturnValue({ env: 'LIMIT', fallback: 5 }),
    };
    const config = { get: jest.fn().mockReturnValue('2') };
    const request = { ip: '127.0.0.1', socket: {} };
    const context = {
      getHandler: () => function login() {},
      getClass: () => class AuthController {},
      switchToHttp: () => ({ getRequest: () => request }),
    } as unknown as ExecutionContext;
    const guard = new RateLimitGuard(
      reflector as unknown as Reflector,
      config as unknown as ConfigService,
    );
    expect(guard.canActivate(context)).toBe(true);
    expect(guard.canActivate(context)).toBe(true);
    expect(() => guard.canActivate(context)).toThrow(HttpException);
  });
});
