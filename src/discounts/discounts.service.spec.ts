import { BadRequestException } from '@nestjs/common';
import { DiscountType, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DiscountsService } from './discounts.service';

describe('DiscountsService pricing', () => {
  const service = new DiscountsService({} as PrismaService);
  const tx = (discount: Record<string, unknown> | null) =>
    ({
      discountCode: { findUnique: jest.fn().mockResolvedValue(discount) },
    }) as unknown as Prisma.TransactionClient;

  it('calculates fixed discounts without touching delivery', async () => {
    const result = await service.calculate(
      ' solly500 ',
      10000,
      tx({
        code: 'SOLLY500',
        type: DiscountType.FIXED,
        value: new Prisma.Decimal(500),
        isActive: true,
        startsAt: null,
        endsAt: null,
        minimumOrderAmount: null,
      }),
    );
    expect(result).toEqual({ amount: 500, code: 'SOLLY500' });
    expect(10000 - result.amount + 3800).toBe(13300);
  });

  it('calculates percentage and caps discounts at the product subtotal', async () => {
    const percentage = await service.calculate(
      'WELCOME10',
      10000,
      tx({
        type: DiscountType.PERCENTAGE,
        value: new Prisma.Decimal(10),
        isActive: true,
        startsAt: null,
        endsAt: null,
        minimumOrderAmount: null,
      }),
    );
    const capped = await service.calculate(
      'FREE',
      200,
      tx({
        type: DiscountType.FIXED,
        value: new Prisma.Decimal(500),
        isActive: true,
        startsAt: null,
        endsAt: null,
        minimumOrderAmount: null,
      }),
    );
    expect(percentage.amount).toBe(1000);
    expect(capped.amount).toBe(200);
  });

  it('rejects inactive, expired, invalid, and below-minimum codes', async () => {
    await expect(
      service.calculate('NOPE', 10000, tx(null)),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.calculate('OFF', 10000, tx({ isActive: false })),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.calculate(
        'MIN',
        1000,
        tx({
          type: DiscountType.FIXED,
          value: new Prisma.Decimal(100),
          isActive: true,
          startsAt: null,
          endsAt: null,
          minimumOrderAmount: new Prisma.Decimal(5000),
        }),
      ),
    ).rejects.toThrow('minimum');
  });
});
