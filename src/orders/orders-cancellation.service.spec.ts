/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-return */
import { BadRequestException } from '@nestjs/common';
import {
  MovementReason,
  OrderStatus,
  PaymentStatus,
  Prisma,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { OrdersService } from './orders.service';

describe('OrdersService cancellation', () => {
  const makeService = (
    order: Record<string, unknown>,
    usage: Record<string, unknown>[] = [],
  ) => {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest
          .fn()
          .mockImplementation(({ data }) =>
            Promise.resolve({ ...order, ...data }),
          ),
      },
      resourceMovement: {
        findMany: jest.fn().mockResolvedValue(usage),
        create: jest.fn().mockResolvedValue({}),
      },
      resource: { update: jest.fn().mockResolvedValue({}) },
      orderStatusHistory: { create: jest.fn().mockResolvedValue({}) },
    };
    const prisma = {
      $transaction: jest.fn().mockImplementation((callback) => callback(tx)),
    };
    const service = new OrdersService(
      prisma as unknown as PrismaService,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
      {} as never,
    );
    return { service, tx };
  };

  it('cancels an unpaid order without inventory movement', async () => {
    const { service, tx } = makeService({
      id: 'o1',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.UNPAID,
    });
    const result = await service.cancel('o1', {
      reason: 'Customer request',
      restoreInventory: true,
    });
    expect(result.status).toBe(OrderStatus.CANCELLED);
    expect(tx.resourceMovement.findMany).not.toHaveBeenCalled();
    expect(tx.orderStatusHistory.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: OrderStatus.CANCELLED,
        note: 'Customer request',
      }),
    });
  });

  it('keeps paid status and does not return stock unless explicitly requested', async () => {
    const { service, tx } = makeService({
      id: 'o1',
      status: OrderStatus.PENDING,
      paymentStatus: PaymentStatus.PAID,
      inventoryRestoredAt: null,
    });
    const result = await service.cancel('o1', {
      reason: 'Materials used',
      restoreInventory: false,
    });
    expect(result.paymentStatus).toBe(PaymentStatus.PAID);
    expect(tx.resourceMovement.create).not.toHaveBeenCalled();
  });

  it('restores exact historical usage with positive RETURN movements', async () => {
    const usage = [
      {
        resourceId: 'film',
        quantity: new Prisma.Decimal(-2),
        unitCost: new Prisma.Decimal(500),
      },
    ];
    const { service, tx } = makeService(
      {
        id: 'o1',
        status: OrderStatus.PENDING,
        paymentStatus: PaymentStatus.PAID,
        inventoryRestoredAt: null,
      },
      usage,
    );
    await service.cancel('o1', {
      reason: 'Unused materials',
      restoreInventory: true,
    });
    expect(tx.resource.update).toHaveBeenCalledWith({
      where: { id: 'film' },
      data: { currentStock: { increment: new Prisma.Decimal(2) } },
    });
    expect(tx.resourceMovement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        reason: MovementReason.RETURN,
        quantity: new Prisma.Decimal(2),
        unitCost: new Prisma.Decimal(500),
      }),
    });
  });

  it('rejects repeated cancellation so stock cannot be restored twice', async () => {
    const { service } = makeService({
      id: 'o1',
      status: OrderStatus.CANCELLED,
      paymentStatus: PaymentStatus.PAID,
      inventoryRestoredAt: new Date(),
    });
    await expect(
      service.cancel('o1', { reason: 'Again', restoreInventory: true }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
