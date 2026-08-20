/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { NotFoundException } from '@nestjs/common';

import { OrderStatus, PaymentStatus } from '../generated/prisma/client';
import { PhoneNumberService } from '../customers/phone-number.service';
import { PrismaService } from '../prisma/prisma.service';
import { TrackingService } from './tracking.service';

describe('TrackingService', () => {
  const paidOrder = {
    id: 'order-1',
    trackingToken: 'secure-token',
    orderNumber: 'PBS-1',
    status: OrderStatus.PRINTING,
    paymentStatus: PaymentStatus.PAID,
    createdAt: new Date('2026-08-01T10:00:00Z'),
    paidAt: new Date('2026-08-01T11:00:00Z'),
    totalAmount: 10800,
    deliveryState: 'Lagos',
    deliveryAddress: '12 Marina Road, Victoria Island, Lagos',
    trackingLink: null,
    adminNote: 'private',
    grossProfitSnapshot: 5000,
    items: [
      {
        quantity: 2,
        customization: { finalPngUrl: 'https://private/final.png' },
        variant: { name: 'Standard', product: { name: 'Polaroids' } },
      },
    ],
    statusHistory: [
      {
        status: OrderStatus.PENDING,
        changedAt: new Date('2026-08-01T10:00:00Z'),
        note: 'private note',
      },
      {
        status: OrderStatus.PRINTING,
        changedAt: new Date('2026-08-02T10:00:00Z'),
        note: 'admin detail',
      },
    ],
  };

  it('returns only paid phone-matched customer-safe order cards', async () => {
    const findMany = jest.fn().mockResolvedValue([paidOrder]);
    const prisma = { order: { findMany } } as unknown as PrismaService;
    const service = new TrackingService(prisma, new PhoneNumberService());

    const result = await service.findByPhone('08012345678');

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ paymentStatus: PaymentStatus.PAID }),
      }),
    );
    expect(JSON.stringify(result)).not.toContain('adminNote');
    expect(JSON.stringify(result)).not.toContain('grossProfitSnapshot');
    expect(JSON.stringify(result)).not.toContain('finalPngUrl');
    expect(JSON.stringify(result)).not.toContain('12 Marina Road');
  });

  it('returns a chronological note-free timeline for a valid token', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(paidOrder) },
    } as unknown as PrismaService;
    const service = new TrackingService(prisma, new PhoneNumberService());

    const result = await service.findOne('secure-token');

    expect(result.maskedDeliveryAddress).toBe('Victoria Island, Lagos');
    expect(result.timeline).toEqual([
      {
        status: OrderStatus.PENDING,
        changedAt: paidOrder.statusHistory[0].changedAt,
      },
      {
        status: OrderStatus.PRINTING,
        changedAt: paidOrder.statusHistory[1].changedAt,
      },
    ]);
    expect(JSON.stringify(result.timeline)).not.toContain('note');
  });

  it('returns a neutral 404 for an invalid token', async () => {
    const prisma = {
      order: { findFirst: jest.fn().mockResolvedValue(null) },
    } as unknown as PrismaService;
    await expect(
      new TrackingService(prisma, new PhoneNumberService()).findOne('invalid'),
    ).rejects.toThrow(NotFoundException);
  });
});
