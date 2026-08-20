/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CustomersService } from './customers.service';
import { PhoneNumberService } from './phone-number.service';

describe('CustomersService', () => {
  it('searches safely and calculates spend from paid orders only', async () => {
    const findMany = jest.fn().mockResolvedValue([
      {
        id: 'customer-1',
        name: 'Jane Doe',
        phone: '+2348012345678',
        email: 'jane@example.com',
        isArchived: false,
        orders: [
          {
            paymentStatus: PaymentStatus.PAID,
            totalAmount: new Prisma.Decimal(10000),
            createdAt: new Date('2026-08-02'),
          },
          {
            paymentStatus: PaymentStatus.UNPAID,
            totalAmount: new Prisma.Decimal(20000),
            createdAt: new Date('2026-08-01'),
          },
        ],
      },
    ]);
    const service = new CustomersService(
      {
        customer: { findMany, count: jest.fn().mockResolvedValue(1) },
      } as unknown as PrismaService,
      new PhoneNumberService(),
    );
    const result = await service.findAll({ phone: '08012345678' });
    expect(result.data[0].totalSpent.toString()).toBe('10000');
    expect(result.data[0].paidOrders).toBe(1);
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          phone: { in: expect.arrayContaining(['+2348012345678']) },
        }),
      }),
    );
  });
});
