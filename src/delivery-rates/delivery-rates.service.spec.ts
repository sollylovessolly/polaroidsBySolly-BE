import { BadRequestException, ConflictException } from '@nestjs/common';

import { PrismaService } from '../prisma/prisma.service';
import { DeliveryRatesService } from './delivery-rates.service';

describe('DeliveryRatesService', () => {
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const create = jest.fn();
  const update = jest.fn();
  const prisma = {
    deliveryRate: {
      findUnique,
      findFirst,
      create,
      update,
      findMany: jest.fn(),
    },
  } as unknown as PrismaService;
  const service = new DeliveryRatesService(prisma);

  beforeEach(() => jest.clearAllMocks());

  it.each(['Lagos', 'lagos', 'LAGOS', ' Lagos '])(
    'normalizes %p and resolves the Lagos fee',
    async (state) => {
      findUnique.mockResolvedValue({
        state: 'Lagos',
        normalizedState: 'lagos',
        fee: 3800,
        isActive: true,
      });

      const rate = await service.resolve(state);

      expect(Number(rate.fee)).toBe(3800);
      expect(findUnique).toHaveBeenCalledWith({
        where: { normalizedState: 'lagos' },
      });
    },
  );

  it('rejects unsupported and inactive states without a free fallback', async () => {
    findUnique.mockResolvedValueOnce(null).mockResolvedValueOnce({
      state: 'Lagos',
      fee: 3800,
      isActive: false,
    });

    await expect(service.resolve('Ogun')).rejects.toThrow(BadRequestException);
    await expect(service.resolve('Lagos')).rejects.toThrow(BadRequestException);
  });

  it('prevents duplicate rates with different casing', async () => {
    findUnique.mockResolvedValue({ state: 'Lagos' });

    await expect(
      service.create({ state: '  LAGOS ', fee: 4000 }),
    ).rejects.toThrow(ConflictException);
    expect(create).not.toHaveBeenCalled();
  });

  it('returns an easy frontend availability response', async () => {
    findUnique.mockResolvedValueOnce({
      state: 'Lagos',
      fee: 3800,
      isActive: true,
    });
    await expect(service.findByState('lagos')).resolves.toEqual({
      state: 'Lagos',
      fee: 3800,
      available: true,
    });

    findUnique.mockResolvedValueOnce(null);
    await expect(service.findByState('Ogun')).resolves.toEqual({
      state: 'Ogun',
      available: false,
    });
  });
});
