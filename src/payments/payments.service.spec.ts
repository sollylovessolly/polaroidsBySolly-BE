/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { BadRequestException, ConflictException } from '@nestjs/common';

import {
  PaymentMethod,
  PaymentStatus,
  ProductCategory,
  ResourceCategory,
} from '../generated/prisma/client';
import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { PaymentsService } from './payments.service';
import { PaystackService, PaystackTransaction } from './paystack.service';

describe('PaymentsService', () => {
  const successfulTransaction: PaystackTransaction = {
    status: 'success',
    reference: 'paystack-ref',
    amount: 1_080_000,
    currency: 'NGN',
    paid_at: '2026-08-11T12:00:00.000Z',
    metadata: { orderId: 'order-1' },
  };

  it('initializes Paystack with the backend total converted to kobo', async () => {
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'order-1',
          orderNumber: 'PBS-1',
          customerId: 'customer-1',
          totalAmount: '10800',
          paymentStatus: PaymentStatus.UNPAID,
          customer: { email: 'jane@example.com' },
        }),
      },
    } as unknown as PrismaService;
    const initializeTransaction = jest.fn().mockResolvedValue({
      authorization_url: 'https://checkout.paystack.com/code',
      access_code: 'code',
      reference: 'paystack-ref',
    });
    const service = new PaymentsService(
      prisma,
      {} as InventoryService,
      {} as InventoryAvailabilityService,
      { initializeTransaction } as unknown as PaystackService,
    );

    await expect(service.initialize({ orderId: 'order-1' })).resolves.toEqual({
      authorizationUrl: 'https://checkout.paystack.com/code',
      accessCode: 'code',
      reference: 'paystack-ref',
    });
    expect(initializeTransaction).toHaveBeenCalledWith({
      email: 'jane@example.com',
      amount: 1_080_000,
      metadata: {
        orderId: 'order-1',
        orderNumber: 'PBS-1',
        customerId: 'customer-1',
      },
    });
  });

  it('rejects failed or amount-mismatched verification before a DB transaction', async () => {
    const transaction = { ...successfulTransaction, status: 'failed' };
    const prisma = {
      order: { findUnique: jest.fn() },
      $transaction: jest.fn(),
    } as unknown as PrismaService;
    const verifyTransaction = jest.fn().mockResolvedValue(transaction);
    const service = new PaymentsService(
      prisma,
      {} as InventoryService,
      {} as InventoryAvailabilityService,
      { verifyTransaction } as unknown as PaystackService,
    );

    await expect(service.verify({ reference: 'paystack-ref' })).rejects.toThrow(
      BadRequestException,
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();

    verifyTransaction.mockResolvedValue({
      ...successfulTransaction,
      amount: 1_000_000,
    });
    (prisma.order.findUnique as jest.Mock).mockResolvedValue({
      id: 'order-1',
      totalAmount: 10800,
    });
    await expect(service.verify({ reference: 'paystack-ref' })).rejects.toThrow(
      'Payment amount mismatch',
    );
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('deducts and records a verified payment exactly once across retries', async () => {
    let payment: Record<string, unknown> | null = null;
    const order = {
      id: 'order-1',
      totalAmount: 10800,
      actualDeliveryCost: 0,
      paymentStatus: PaymentStatus.UNPAID,
      inventoryDeductedAt: null,
      items: [
        {
          quantity: 2,
          customization: {
            finalPngUrl: 'https://storage/final.png',
            previewUrl: 'https://storage/preview.png',
          },
          outsourcedCostSnapshot: 0,
          variant: {
            id: 'polaroid',
            sku: 'POLAROID-STANDARD',
            product: { category: ProductCategory.POLAROID },
          },
        },
      ],
    };
    const paymentCreate = jest.fn(
      ({ data }: { data: Record<string, unknown> }) => {
        payment = { ...data, orderId: 'order-1' };
        return Promise.resolve(payment);
      },
    );
    const orderUpdate = jest.fn().mockResolvedValue(order);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      payment: {
        findUnique: jest.fn(() => Promise.resolve(payment)),
        create: paymentCreate,
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: orderUpdate,
      },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const assertOrderAvailability = jest.fn().mockResolvedValue([
      { resourceId: 'film', requiredQuantity: 2 },
      { resourceId: 'box', requiredQuantity: 1 },
      { resourceId: 'stickers', requiredQuantity: 2 },
    ]);
    const consumeResource = jest
      .fn()
      .mockResolvedValueOnce({
        category: ResourceCategory.MATERIAL,
        totalCost: 1000,
      })
      .mockResolvedValueOnce({
        category: ResourceCategory.PACKAGING,
        totalCost: 200,
      })
      .mockResolvedValueOnce({
        category: ResourceCategory.CONSUMABLE,
        totalCost: 100,
      });
    const service = new PaymentsService(
      prisma,
      { consumeResource } as unknown as InventoryService,
      { assertOrderAvailability } as unknown as InventoryAvailabilityService,
      {
        verifyTransaction: jest.fn().mockResolvedValue(successfulTransaction),
      } as unknown as PaystackService,
    );

    await service.verify({ reference: 'paystack-ref' });
    await service.verify({ reference: 'paystack-ref' });
    await service.handleWebhook({
      event: 'charge.success',
      data: { reference: 'paystack-ref' },
    });

    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(consumeResource).toHaveBeenCalledTimes(3);
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        paymentStatus: PaymentStatus.PAID,
        materialCostSnapshot: 1000,
        packagingCostSnapshot: 300,
        grossProfitSnapshot: 9500,
      }),
    });
  });

  it('records an externally paid order as fulfillment-blocked when stock is gone', async () => {
    let payment: Record<string, unknown> | null = null;
    const order = {
      id: 'order-1',
      totalAmount: 10800,
      actualDeliveryCost: 0,
      paymentStatus: PaymentStatus.UNPAID,
      inventoryDeductedAt: null,
      adminNote: null,
      items: [],
    };
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      payment: {
        findUnique: jest.fn(() => Promise.resolve(payment)),
        create: jest.fn(({ data }: { data: Record<string, unknown> }) => {
          payment = { ...data, orderId: 'order-1' };
          return Promise.resolve(payment);
        }),
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: jest.fn().mockResolvedValue(order),
      },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      {} as InventoryService,
      {
        assertOrderAvailability: jest
          .fn()
          .mockRejectedValue(new BadRequestException('Not enough Film')),
      } as unknown as InventoryAvailabilityService,
      {
        verifyTransaction: jest.fn().mockResolvedValue(successfulTransaction),
      } as unknown as PaystackService,
    );

    await expect(service.verify({ reference: 'paystack-ref' })).rejects.toThrow(
      ConflictException,
    );
    expect(tx.payment.create).toHaveBeenCalledTimes(1);
    expect(tx.order.update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        paymentStatus: PaymentStatus.PAID,
        adminNote: expect.stringContaining('FULFILLMENT BLOCKED'),
      }),
    });
    expect(tx.order.update.mock.calls[0][0].data).not.toHaveProperty(
      'inventoryDeductedAt',
    );
  });

  it('finalizes a manual transfer through the same inventory engine', async () => {
    const order = {
      id: 'order-1',
      orderNumber: 'PBS-1',
      totalAmount: 10800,
      actualDeliveryCost: 3500,
      paymentStatus: PaymentStatus.UNPAID,
      inventoryDeductedAt: null,
      items: [],
    };
    let payment: Record<string, unknown> | null = null;
    const paymentCreate = jest.fn(
      ({ data }: { data: Record<string, unknown> }) => {
        payment = { ...data, orderId: 'order-1' };
        return Promise.resolve(payment);
      },
    );
    const orderUpdate = jest.fn().mockResolvedValue(order);
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ id: 'order-1' }]),
      payment: {
        findUnique: jest.fn(() => Promise.resolve(payment)),
        create: paymentCreate,
      },
      order: {
        findUnique: jest.fn().mockResolvedValue(order),
        update: orderUpdate,
      },
    };
    const prisma = {
      order: { findUnique: jest.fn().mockResolvedValue(order) },
      $transaction: jest.fn((callback: (client: typeof tx) => unknown) =>
        callback(tx),
      ),
    } as unknown as PrismaService;
    const service = new PaymentsService(
      prisma,
      {} as InventoryService,
      {
        assertOrderAvailability: jest.fn().mockResolvedValue([]),
      } as unknown as InventoryAvailabilityService,
      {} as PaystackService,
    );

    await service.recordManualPayment({
      orderId: 'order-1',
      method: PaymentMethod.TRANSFER,
      reference: 'TRANSFER-1',
    });
    await service.recordManualPayment({
      orderId: 'order-1',
      method: PaymentMethod.TRANSFER,
      reference: 'TRANSFER-1',
    });

    expect(paymentCreate).toHaveBeenCalledTimes(1);
    expect(paymentCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        method: PaymentMethod.TRANSFER,
        amount: expect.anything(),
        reference: 'TRANSFER-1',
      }),
    });
    expect(orderUpdate).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        revenueSnapshot: 10800,
        deliveryCostSnapshot: 3500,
        grossProfitSnapshot: 7300,
      }),
    });
  });
});
