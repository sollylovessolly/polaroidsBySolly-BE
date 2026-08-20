import 'dotenv/config';
import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Prefer a direct (non-pooler) connection for the pg adapter. The adapter
    // manages its own pool, so routing through Neon's PgBouncer pooler causes
    // interactive transactions to fail with P2028 ("Unable to start a
    // transaction in the given time"). Fall back to DATABASE_URL if DIRECT_URL
    // is not set.
    const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

    if (!connectionString) {
      throw new Error(
        'Neither DIRECT_URL nor DATABASE_URL is set in the environment',
      );
    }

    const adapter = new PrismaPg({
      connectionString,
      max: 10,
      connectionTimeoutMillis: 20_000,
      idleTimeoutMillis: 30_000,
    });

    super({ adapter });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
