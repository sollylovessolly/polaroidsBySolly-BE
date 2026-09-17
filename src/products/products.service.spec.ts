import { Test, TestingModule } from '@nestjs/testing';

import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { PrismaService } from '../prisma/prisma.service';
import { ProductsService } from './products.service';

describe('ProductsService', () => {
  let service: ProductsService;

  const prismaMock = {
    product: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    resource: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const inventoryAvailabilityMock = {
    getVariantAvailability: jest.fn(),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProductsService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InventoryAvailabilityService,
          useValue: inventoryAvailabilityMock,
        },
      ],
    }).compile();

    service = module.get<ProductsService>(ProductsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('merges live availability into each variant on findAll', async () => {
    prismaMock.product.findMany.mockResolvedValue([
      {
        id: 'product-1',
        name: 'Polaroids',
        slug: 'polaroids',
        description: null,
        category: 'POLAROID',
        variants: [
          {
            id: 'variant-1',
            name: 'Standard',
            sku: 'POLAROID-STANDARD',
            sellingPrice: 3500,
            tracksStock: false,
            isActive: true,
          },
        ],
      },
    ]);

    inventoryAvailabilityMock.getVariantAvailability.mockResolvedValue(
      new Map([
        [
          'variant-1',
          {
            inStock: true,
            availableQuantity: 12,
            reasonIfUnavailable: null,
          },
        ],
      ]),
    );

    const result = await service.findAll();

    expect(
      inventoryAvailabilityMock.getVariantAvailability,
    ).toHaveBeenCalledWith(['variant-1']);
    expect(result[0].variants[0]).toEqual(
      expect.objectContaining({
        id: 'variant-1',
        inStock: true,
        availableQuantity: 12,
        reasonIfUnavailable: null,
      }),
    );
  });
});
