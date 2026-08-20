/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/unbound-method */
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OwnerWithdrawalsService } from './owner-withdrawals.service';

describe('OwnerWithdrawalsService', () => {
  it('stores Decimal money without creating an Expense', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'withdrawal-1' });
    const prisma = {
      ownerWithdrawal: { create },
      expense: { create: jest.fn() },
    } as unknown as PrismaService;
    await new OwnerWithdrawalsService(prisma).create({ amount: 100000 });
    expect(create).toHaveBeenCalledWith({
      data: { amount: expect.any(Prisma.Decimal) },
    });
    expect(prisma.expense.create).not.toHaveBeenCalled();
  });

  it('returns withdrawal summary independently from profit', async () => {
    const prisma = {
      ownerWithdrawal: {
        aggregate: jest.fn().mockResolvedValue({
          _sum: { amount: new Prisma.Decimal(250000) },
          _count: 3,
        }),
      },
    } as unknown as PrismaService;
    const result = await new OwnerWithdrawalsService(prisma).summary();
    expect(result.totalWithdrawn.toString()).toBe('250000');
    expect(result.count).toBe(3);
  });
});
