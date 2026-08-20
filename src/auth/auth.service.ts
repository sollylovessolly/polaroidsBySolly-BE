import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { AdminTokenService } from './admin-token.service';
import { AdminLoginDto } from './dto/admin-login.dto';
import { PasswordService } from './password.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: AdminTokenService,
  ) {}

  async login(dto: AdminLoginDto) {
    const admin = await this.prisma.admin.findUnique({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (
      !admin?.isActive ||
      !(await this.passwords.verify(dto.password, admin.passwordHash))
    ) {
      this.logger.warn({ event: 'admin_login_failed' });
      throw new UnauthorizedException('Invalid email or password');
    }
    return {
      accessToken: this.tokens.sign({ id: admin.id, email: admin.email }),
      expiresIn: this.tokens.getExpiresInSeconds(),
      admin: { id: admin.id, email: admin.email, name: admin.name },
    };
  }

  async me(adminId: string) {
    const admin = await this.prisma.admin.findUnique({
      where: { id: adminId },
      select: { id: true, email: true, name: true, isActive: true },
    });
    if (!admin?.isActive) throw new UnauthorizedException();
    return admin;
  }
}
