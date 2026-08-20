import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HealthService {
  private readonly logger = new Logger(HealthService.name);
  constructor(private readonly prisma: PrismaService) {}

  async database() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return {
        status: 'ok',
        database: 'ok',
        timestamp: new Date().toISOString(),
      };
    } catch {
      this.logger.error({ event: 'database_health_failed' });
      return {
        status: 'not_ready',
        database: 'unavailable',
        timestamp: new Date().toISOString(),
      };
    }
  }
}
