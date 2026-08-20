/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipbubbleService } from './shipbubble.service';
import { ShippingService } from './shipping.service';

describe('ShippingService', () => {
  const paidOrder = {
    id: 'order-1',
    paymentStatus: PaymentStatus.PAID,
    shipmentReference: null,
    shipmentRequestToken: 'rate-token',
    shipmentServiceCode: 'courier',
    shipmentCourierId: 'courier-id',
    revenueSnapshot: new Prisma.Decimal(12800),
    materialCostSnapshot: new Prisma.Decimal(2000),
    packagingCostSnapshot: new Prisma.Decimal(500),
    outsourceCostSnapshot: new Prisma.Decimal(1000),
  };

  it('builds rates from server-side SKU prices and returns provider-safe choices', async () => {
    const prisma = {
      productVariant: {
        findMany: jest.fn().mockResolvedValue([
          {
            sku: 'POLAROID-STANDARD',
            name: 'Standard',
            sellingPrice: new Prisma.Decimal(3500),
            product: { name: 'Polaroids' },
          },
        ]),
      },
    };
    const provider = {
      isConfigured: () => true,
      validateAddress: jest.fn().mockResolvedValue(123),
      fetchRates: jest
        .fn()
        .mockResolvedValue({ requestToken: 'token', couriers: [] }),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShipbubbleService,
    );
    await service.rates({
      name: 'Jane',
      email: 'jane@example.com',
      phone: '0801',
      address: '12 Marina',
      state: 'Lagos',
      items: [{ variantSku: 'POLAROID-STANDARD', quantity: 2 }],
    });
    expect(provider.fetchRates).toHaveBeenCalledWith(
      expect.objectContaining({
        receiverAddressCode: 123,
        packageItems: [
          expect.objectContaining({ unit_amount: '3500', quantity: '2' }),
        ],
      }),
    );
  });

  it('creates one paid shipment and freezes actual courier cost/profit', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'order-1' });
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue(paidOrder),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update,
      },
    };
    const provider = {
      isConfigured: () => true,
      createShipment: jest.fn().mockResolvedValue({
        orderId: 'SB-1',
        status: 'pending',
        trackingUrl: 'https://track',
        shippingFee: 3500,
      }),
    };
    const result = await new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShipbubbleService,
    ).attempt('order-1');
    expect(result.created).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({
        shipmentReference: 'SB-1',
        actualDeliveryCost: new Prisma.Decimal(3500),
        deliveryCostSnapshot: new Prisma.Decimal(3500),
        grossProfitSnapshot: new Prisma.Decimal(5800),
      }),
    });
  });

  it('does not create for unpaid or duplicate paid orders', async () => {
    const provider = { isConfigured: () => true, createShipment: jest.fn() };
    const prisma = {
      order: {
        findUnique: jest.fn().mockResolvedValue({
          ...paidOrder,
          paymentStatus: PaymentStatus.UNPAID,
        }),
      },
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShipbubbleService,
    );
    await expect(service.attempt('order-1')).resolves.toMatchObject({
      reason: 'ORDER_UNPAID',
    });
    prisma.order.findUnique.mockResolvedValue({
      ...paidOrder,
      shipmentReference: 'SB-existing',
    });
    await expect(service.attempt('order-1')).resolves.toMatchObject({
      reason: 'ALREADY_CREATED',
    });
    expect(provider.createShipment).not.toHaveBeenCalled();
  });

  it('stores provider failure without changing payment and permits retry', async () => {
    const findUnique = jest.fn().mockResolvedValue(paidOrder);
    const update = jest.fn().mockResolvedValue(paidOrder);
    const prisma = {
      order: {
        findUnique,
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update,
      },
    };
    const provider = {
      isConfigured: () => true,
      createShipment: jest.fn().mockRejectedValue(new Error('provider down')),
    };
    const service = new ShippingService(
      prisma as unknown as PrismaService,
      provider as unknown as ShipbubbleService,
    );
    await expect(service.attempt('order-1')).resolves.toMatchObject({
      reason: 'PROVIDER_FAILED',
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: 'order-1' },
      data: expect.objectContaining({ shipmentStatus: 'FAILED' }),
    });
    await service.retry('order-1');
    expect(provider.createShipment).toHaveBeenCalledTimes(2);
  });
});
