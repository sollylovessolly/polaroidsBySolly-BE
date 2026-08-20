/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { BadRequestException } from '@nestjs/common';

import {
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from '../generated/prisma/client';
import { PaymentsService } from '../payments/payments.service';
import { PhoneNumberService } from '../customers/phone-number.service';
import { PrismaService } from '../prisma/prisma.service';
import { OrderCustomizationService } from './order-customization.service';
import { OrdersService } from './orders.service';

describe('OrdersService admin workflow', () => {
  const buildService = (
    prisma: PrismaService,
    payments = {} as PaymentsService,
  ) =>
    new OrdersService(
      prisma,
      {} as never,
      {} as never,
      {} as never,
      payments,
      new PhoneNumberService(),
    );

  it('updates paid delivery cost using frozen historical production costs', async () => {
    const order = {
      id: 'order-1',
      paymentStatus: PaymentStatus.PAID,
      revenueSnapshot: 10800,
      materialCostSnapshot: 1800,
      packagingCostSnapshot: 500,
      outsourceCostSnapshot: 0,
    };
    const update = jest.fn().mockResolvedValue({ id: 'order-1' });
    const tx = {
      order: { findUnique: jest.fn().mockResolvedValue(order), update },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await buildService(prisma).updateDeliveryCost('order-1', {
      actualDeliveryCost: 3500,
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: {
        actualDeliveryCost: 3500,
        deliveryCostSnapshot: 3500,
        grossProfitSnapshot: 5000,
      },
    });
  });

  it('updates status and appends history without inventory/payment changes', async () => {
    const update = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: OrderStatus.DESIGNING,
    });
    const historyCreate = jest.fn().mockResolvedValue({ id: 'history-1' });
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.PENDING,
        }),
        update,
      },
      orderStatusHistory: { create: historyCreate },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await buildService(prisma).updateStatus('order-1', {
      status: OrderStatus.DESIGNING,
      note: 'Starting customer design',
    });

    expect(historyCreate).toHaveBeenCalledWith({
      data: {
        orderId: 'order-1',
        status: OrderStatus.DESIGNING,
        note: 'Starting customer design',
      },
    });
  });

  it('treats delivered and cancelled orders as terminal', async () => {
    const tx = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          status: OrderStatus.DELIVERED,
        }),
      },
    };
    const prisma = {
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;

    await expect(
      buildService(prisma).updateStatus('order-1', {
        status: OrderStatus.PRINTING,
      }),
    ).rejects.toThrow(BadRequestException);
  });

  it('filters admin orders by source and search', async () => {
    const findMany = jest.fn().mockResolvedValue([]);
    const prisma = {
      order: { findMany, count: jest.fn().mockResolvedValue(0) },
    } as unknown as PrismaService;

    await buildService(prisma).findAll({
      source: OrderSource.WHATSAPP,
      search: 'Jane',
    });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          source: OrderSource.WHATSAPP,
          OR: expect.any(Array),
        }),
      }),
    );
  });

  it('updates admin note and tracking without overwriting customer note', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'order-1' });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          customerNote: 'Package carefully',
        }),
        update,
      },
    } as unknown as PrismaService;
    const service = buildService(prisma);

    await service.updateAdminNote('order-1', { adminNote: 'Friday delivery' });
    await service.updateTracking('order-1', {
      trackingLink: 'https://tracking.example/PBS-1',
    });

    expect(update).toHaveBeenNthCalledWith(1, {
      where: { id: 'order-1' },
      data: { adminNote: 'Friday delivery' },
    });
    expect(update).toHaveBeenNthCalledWith(2, {
      where: { id: 'order-1' },
      data: { trackingLink: 'https://tracking.example/PBS-1' },
    });
    expect(update.mock.calls[0][0].data).not.toHaveProperty('customerNote');
  });

  it('delegates manual payment to the shared finalization engine', async () => {
    const recordManualPayment = jest.fn().mockResolvedValue({ id: 'order-1' });
    const payments = { recordManualPayment } as unknown as PaymentsService;

    await buildService({} as PrismaService, payments).recordManualPayment(
      'order-1',
      { method: PaymentMethod.TRANSFER, reference: 'TRANSFER-1' },
    );

    expect(recordManualPayment).toHaveBeenCalledWith({
      orderId: 'order-1',
      method: PaymentMethod.TRANSFER,
      reference: 'TRANSFER-1',
    });
  });

  it('replaces only validated fulfillment metadata on an order item', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'item-1' });
    const prisma = {
      orderItem: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'item-1',
          variant: { product: { category: 'POLAROID' } },
        }),
        update,
      },
    } as unknown as PrismaService;
    const service = new OrdersService(
      prisma,
      {} as never,
      new OrderCustomizationService(),
      {} as never,
      {} as PaymentsService,
      new PhoneNumberService(),
    );

    await service.updateFulfillment('order-1', 'item-1', {
      customization: {
        finalPngUrl: 'https://storage.example/new-final.png',
        previewUrl: 'https://storage.example/new-preview.png',
        price: 1,
      },
    });

    expect(update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: {
        customization: {
          finalPngUrl: 'https://storage.example/new-final.png',
          previewUrl: 'https://storage.example/new-preview.png',
        },
      },
    });
  });
});
