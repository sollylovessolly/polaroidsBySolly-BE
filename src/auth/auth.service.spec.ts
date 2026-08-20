import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { PrismaService } from '../prisma/prisma.service';
import { AdminTokenService } from './admin-token.service';
import { AuthService } from './auth.service';
import { PasswordService } from './password.service';

describe('Admin authentication', () => {
  const config = {
    get: jest.fn((key: string, fallback?: number) => {
      if (key === 'JWT_SECRET')
        return 'a-secure-test-secret-that-is-at-least-32-characters';
      if (key === 'JWT_EXPIRES_IN_SECONDS') return fallback ?? 3600;
      return undefined;
    }),
  } as unknown as ConfigService;

  it('hashes passwords and returns a signed token without passwordHash', async () => {
    const passwords = new PasswordService();
    const passwordHash = await passwords.hash('correct-password');
    const prisma = {
      admin: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'admin-1',
          email: 'owner@example.com',
          name: 'Owner',
          passwordHash,
          isActive: true,
        }),
      },
    } as unknown as PrismaService;
    const tokens = new AdminTokenService(config);
    const result = await new AuthService(prisma, passwords, tokens).login({
      email: 'owner@example.com',
      password: 'correct-password',
    });

    expect(tokens.verify(result.accessToken).sub).toBe('admin-1');
    expect(JSON.stringify(result)).not.toContain('passwordHash');
  });

  it('uses the same neutral error for wrong passwords and inactive admins', async () => {
    const passwords = new PasswordService();
    const prisma = {
      admin: {
        findUnique: jest.fn().mockResolvedValue({
          passwordHash: await passwords.hash('correct-password'),
          isActive: false,
        }),
      },
    } as unknown as PrismaService;
    await expect(
      new AuthService(prisma, passwords, new AdminTokenService(config)).login({
        email: 'owner@example.com',
        password: 'wrong-password',
      }),
    ).rejects.toThrow(new UnauthorizedException('Invalid email or password'));
  });

  it('rejects expired tokens', () => {
    const expiredConfig = {
      get: jest.fn((key: string) =>
        key === 'JWT_SECRET'
          ? 'a-secure-test-secret-that-is-at-least-32-characters'
          : -1,
      ),
    } as unknown as ConfigService;
    const tokens = new AdminTokenService(expiredConfig);
    expect(() =>
      tokens.verify(tokens.sign({ id: 'admin-1', email: 'a@b.com' })),
    ).toThrow(UnauthorizedException);
  });
});
