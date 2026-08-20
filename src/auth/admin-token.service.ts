import {
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

export type AdminTokenPayload = { sub: string; email: string; exp: number };

@Injectable()
export class AdminTokenService {
  constructor(private readonly config: ConfigService) {}

  sign(input: { id: string; email: string }) {
    const now = Math.floor(Date.now() / 1000);
    const payload: AdminTokenPayload = {
      sub: input.id,
      email: input.email,
      exp: now + this.getExpiresInSeconds(),
    };
    const header = this.encode({ alg: 'HS256', typ: 'JWT' });
    const body = this.encode(payload);
    return `${header}.${body}.${this.signature(`${header}.${body}`)}`;
  }

  verify(token: string): AdminTokenPayload {
    const [header, body, signature] = token.split('.');
    if (!header || !body || !signature) throw new UnauthorizedException();
    const expected = Buffer.from(this.signature(`${header}.${body}`));
    const received = Buffer.from(signature);
    if (
      received.length !== expected.length ||
      !timingSafeEqual(received, expected)
    ) {
      throw new UnauthorizedException();
    }
    try {
      const payload = JSON.parse(
        Buffer.from(body, 'base64url').toString(),
      ) as AdminTokenPayload;
      if (!payload.sub || payload.exp <= Math.floor(Date.now() / 1000)) {
        throw new UnauthorizedException();
      }
      return payload;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private signature(value: string) {
    return createHmac('sha256', this.secret())
      .update(value)
      .digest('base64url');
  }

  private encode(value: object) {
    return Buffer.from(JSON.stringify(value)).toString('base64url');
  }

  private secret() {
    const secret = this.config.get<string>('JWT_SECRET');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'Admin authentication is not configured',
      );
    }
    return secret;
  }

  getExpiresInSeconds() {
    return this.config.get<number>('JWT_EXPIRES_IN_SECONDS', 3600);
  }
}
