import { PrismaService } from '../prisma/prisma.service';
import { ResourcesService } from './resources.service';

describe('ResourcesService low-stock reporting', () => {
  it('classifies out, low-at-threshold, and OK resources', async () => {
    const prisma = {
      resource: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'out', name: 'Film', currentStock: 0, lowStockThreshold: 10 },
          {
            id: 'low',
            name: 'Blank iPhone Case',
            currentStock: 2,
            lowStockThreshold: 2,
          },
          { id: 'ok', name: 'Mailer', currentStock: 11, lowStockThreshold: 10 },
        ]),
      },
    } as unknown as PrismaService;
    const service = new ResourcesService(prisma);
    const all = await service.findAll();
    expect(all.map((item) => item.stockStatus)).toEqual([
      'OUT_OF_STOCK',
      'LOW',
      'OK',
    ]);
    await expect(service.lowStock()).resolves.toHaveLength(2);
  });
});
