/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { PaidOrderNotificationsService } from './paid-order-notifications.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';

describe('PaidOrderNotificationsService', () => {
  const order = {
    id: 'order-1',
    orderNumber: 'PBS-1',
    paymentStatus: 'PAID',
    ownerNotifiedAt: null,
    customerEmailSentAt: null,
    trackingToken: 'safe-token',
    source: 'WEBSITE',
    totalAmount: '10800',
    deliveryState: 'Lagos',
    customer: { name: 'Jane', phone: '0801', email: 'jane@example.com' },
    items: [{ quantity: 2, variant: { product: { name: 'Polaroids' } } }],
  };

  it('sends each channel once and includes the frontend tracking URL', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const whatsapp = { sendOwnerMessage: jest.fn().mockResolvedValue(true) };
    const email = { send: jest.fn().mockResolvedValue(true) };
    const config = { get: jest.fn().mockReturnValue('https://shop.example') };
    const service = new PaidOrderNotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsAppNotificationService,
      email as unknown as EmailService,
      config as unknown as ConfigService,
    );
    await service.dispatch(order.id);
    expect(whatsapp.sendOwnerMessage).toHaveBeenCalledTimes(1);
    expect(email.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining(
          'https://shop.example/track-order/safe-token',
        ),
      }),
    );
  });

  it('does not notify for an unpaid order', async () => {
    const prisma = {
      order: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ ...order, paymentStatus: 'UNPAID' }),
        updateMany: jest.fn(),
      },
    };
    const whatsapp = { sendOwnerMessage: jest.fn() };
    const email = { send: jest.fn() };
    const service = new PaidOrderNotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsAppNotificationService,
      email as unknown as EmailService,
      { get: jest.fn() } as unknown as ConfigService,
    );
    await service.dispatch(order.id);
    expect(whatsapp.sendOwnerMessage).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('uses atomic claims to suppress duplicate sends', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
    };
    const whatsapp = { sendOwnerMessage: jest.fn() };
    const email = { send: jest.fn() };
    const service = new PaidOrderNotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsAppNotificationService,
      email as unknown as EmailService,
      { get: jest.fn() } as unknown as ConfigService,
    );
    await service.dispatch(order.id);
    expect(whatsapp.sendOwnerMessage).not.toHaveBeenCalled();
    expect(email.send).not.toHaveBeenCalled();
  });

  it('contains provider failure and releases the claim for a later retry', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          ...order,
          customer: { ...order.customer, email: null },
        }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    };
    const whatsapp = {
      sendOwnerMessage: jest.fn().mockRejectedValue(new Error('provider down')),
    };
    const service = new PaidOrderNotificationsService(
      prisma as unknown as PrismaService,
      whatsapp as unknown as WhatsAppNotificationService,
      { send: jest.fn() } as unknown as EmailService,
      { get: jest.fn() } as unknown as ConfigService,
    );
    await expect(service.dispatch(order.id)).resolves.toBeUndefined();
    expect(prisma.order.updateMany).toHaveBeenLastCalledWith({
      where: expect.objectContaining({
        id: order.id,
        ownerNotifiedAt: expect.any(Date),
      }),
      data: { ownerNotifiedAt: null },
    });
  });
});
