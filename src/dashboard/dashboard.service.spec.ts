import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from '../resources/resources.service';
import { DashboardService } from './dashboard.service';

describe('DashboardService', () => {
  it('uses paid frozen profit, subtracts expenses, and reports withdrawals separately', async () => {
    const prisma = {
      order: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: {
            totalAmount: new Prisma.Decimal(10000),
            grossProfitSnapshot: new Prisma.Decimal(12000),
          },
          _count: 1,
        }),
        count: jest.fn().mockResolvedValue(2),
      },
      expense: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(3000) },
        }),
      },
      ownerWithdrawal: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(4000) },
        }),
      },
    } as unknown as PrismaService;
    const service = new DashboardService(prisma, {
      lowStock: jest.fn().mockResolvedValue([{}]),
    } as unknown as ResourcesService);
    const result = await service.summary({
      from: new Date('2026-08-01T00:00:00Z'),
      to: new Date('2026-09-01T00:00:00Z'),
    });

    expect(result.businessProfit.toString()).toBe('9000');
    expect(result.ownerWithdrawals.toString()).toBe('4000');
    expect(result.retainedAfterWithdrawals.toString()).toBe('5000');
    expect(result.lowStockCount).toBe(1);
  });

  it('returns all twelve months including zero months', async () => {
    const prisma = {
      order: { findMany: jest.fn().mockResolvedValue([]) },
      expense: { findMany: jest.fn().mockResolvedValue([]) },
    } as unknown as PrismaService;
    const result = await new DashboardService(
      prisma,
      {} as ResourcesService,
    ).monthlyProfit(2026);
    expect(result).toHaveLength(12);
    expect(result[0].businessProfit.toString()).toBe('0');
  });
});
