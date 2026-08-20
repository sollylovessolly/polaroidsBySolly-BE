import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { PrismaService } from '../prisma/prisma.service';
import { AdminAuthGuard } from './admin-auth.guard';
import { AdminTokenService } from './admin-token.service';

describe('AdminAuthGuard', () => {
  const context = (authorization?: string) =>
    ({
      getHandler: () => function handler() {},
      getClass: () => class Controller {},
      switchToHttp: () => ({
        getRequest: () => ({ headers: { authorization } }),
      }),
    }) as unknown as ExecutionContext;

  it('returns 401 semantics when a sensitive route has no bearer token', async () => {
    const guard = new AdminAuthGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(false),
      } as unknown as Reflector,
      {} as AdminTokenService,
      {} as PrismaService,
    );
    await expect(guard.canActivate(context())).rejects.toThrow(
      UnauthorizedException,
    );
  });

  it('permits explicitly public routes without a token', async () => {
    const guard = new AdminAuthGuard(
      {
        getAllAndOverride: jest.fn().mockReturnValue(true),
      } as unknown as Reflector,
      {} as AdminTokenService,
      {} as PrismaService,
    );
    await expect(guard.canActivate(context())).resolves.toBe(true);
  });
});
