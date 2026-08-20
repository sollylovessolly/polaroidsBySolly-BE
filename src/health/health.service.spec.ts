import { HealthService } from './health.service';
import { PrismaService } from '../prisma/prisma.service';

describe('HealthService', () => {
  it('reports database readiness without exposing connection details', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]),
    };
    const result = await new HealthService(
      prisma as unknown as PrismaService,
    ).database();
    expect(result).toMatchObject({ status: 'ok', database: 'ok' });
    expect(JSON.stringify(result)).not.toContain('postgresql://');
  });

  it('returns a safe unavailable result on database failure', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('postgresql://secret')),
    };
    const result = await new HealthService(
      prisma as unknown as PrismaService,
    ).database();
    expect(result).toMatchObject({
      status: 'not_ready',
      database: 'unavailable',
    });
    expect(JSON.stringify(result)).not.toContain('secret');
  });
});
