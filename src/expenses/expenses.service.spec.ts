/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { BadRequestException } from '@nestjs/common';

import { ExpenseCategory } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ExpensesService } from './expenses.service';

describe('ExpensesService', () => {
  it('creates a positive expense and validates its related order', async () => {
    const create = jest.fn().mockResolvedValue({ id: 'expense-1' });
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue({ id: 'order-1' }) },
      expense: { create },
    } as unknown as PrismaService;
    const service = new ExpensesService(prisma);
    const dto = {
      title: 'August Internet',
      category: ExpenseCategory.DATA,
      amount: 15000,
      expenseDate: new Date('2026-08-05T10:00:00Z'),
      relatedOrderId: 'order-1',
    };

    await service.create(dto);
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ...dto,
        amount: expect.anything(),
      }),
    });
  });

  it('rejects an unknown related order', async () => {
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(null) },
      expense: { create: jest.fn() },
    } as unknown as PrismaService;
    await expect(
      new ExpensesService(prisma).create({
        title: 'Special courier',
        category: ExpenseCategory.DELIVERY,
        amount: 5000,
        expenseDate: new Date(),
        relatedOrderId: 'missing',
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('filters by category/date and sorts newest first', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      expense: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;
    const service = new ExpensesService(prisma);
    const from = new Date('2026-08-01T00:00:00Z');
    const to = new Date('2026-08-31T23:59:59Z');

    await service.findAll({ category: ExpenseCategory.DATA, from, to });
    expect(findMany).toHaveBeenCalledWith({
      where: {
        category: ExpenseCategory.DATA,
        expenseDate: { gte: from, lte: to },
      },
      orderBy: { expenseDate: 'desc' },
      skip: 0,
      take: 20,
    });
  });

  it('summarizes total and category amounts', async () => {
    const groupBy = jest.fn().mockResolvedValue([
      { category: ExpenseCategory.DATA, _sum: { amount: 15000 } },
      { category: ExpenseCategory.HOSTING, _sum: { amount: 10000 } },
    ]);
    const prisma = { expense: { groupBy } } as unknown as PrismaService;

    const result = await new ExpensesService(prisma).summary();
    expect(result.total.toString()).toBe('25000');
    expect(result.byCategory).toEqual([
      { category: ExpenseCategory.DATA, amount: 15000 },
      { category: ExpenseCategory.HOSTING, amount: 10000 },
    ]);
  });
});
