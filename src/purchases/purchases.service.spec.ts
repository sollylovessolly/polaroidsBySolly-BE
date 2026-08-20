/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { PurchasesService } from './purchases.service';

/**
 * These tests focus on the money/quantity math and the transactional
 * contract of PurchasesService. Prisma is fully mocked so the tests run
 * without a database.
 */
describe('PurchasesService', () => {
  let service: PurchasesService;

  // Captures the arguments passed to inventoryService.applyResourceRestock.
  let restockCalls: Array<{
    resourceId: string;
    quantity: number;
    unitCost: number;
    purchaseId?: string;
  }>;

  let createdPurchaseData: any;
  let createdPurchaseItems: any[];

  const supplierRecord = {
    id: 'supplier-1',
    isActive: true,
  };

  beforeEach(async () => {
    restockCalls = [];
    createdPurchaseItems = [];
    createdPurchaseData = undefined;

    const tx = {
      purchase: {
        create: jest.fn(async ({ data }: any) => {
          createdPurchaseData = data;
          return { id: 'purchase-1', ...data };
        }),
        findUnique: jest.fn(async ({ where }: any) => ({
          id: where.id,
          ...createdPurchaseData,
          items: createdPurchaseItems,
        })),
      },
      purchaseItem: {
        create: jest.fn(async ({ data }: any) => {
          createdPurchaseItems.push(data);
          return data;
        }),
      },
    };

    const prismaMock = {
      supplier: {
        findUnique: jest.fn(async ({ where }: any) =>
          where.id === supplierRecord.id ? supplierRecord : null,
        ),
      },
      // Immediately invoke the callback with our fake tx client.
      $transaction: jest.fn(async (cb: any) => cb(tx)),
    };

    const inventoryMock = {
      applyResourceRestock: jest.fn(async (_tx: any, params: any) => {
        restockCalls.push(params);
        return { resource: {}, movement: {} };
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchasesService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
        {
          provide: InventoryService,
          useValue: inventoryMock,
        },
      ],
    }).compile();

    service = module.get<PurchasesService>(PurchasesService);
  });

  it('converts purchase units to base units and derives unit cost', async () => {
    await service.create({
      supplierId: 'supplier-1',
      items: [
        {
          resourceId: 'film',
          purchaseQuantity: 3,
          purchaseUnit: 'PACK',
          unitsPerPurchaseUnit: 20,
          totalCost: 2700,
        },
      ],
    });

    // 3 packs × 20 sheets = 60 base units; 2700 / 60 = 45 per sheet.
    expect(restockCalls).toHaveLength(1);
    expect(restockCalls[0]).toMatchObject({
      resourceId: 'film',
      quantity: 60,
      unitCost: 45,
      purchaseId: 'purchase-1',
    });

    // The purchase item persists the derived numbers too.
    expect(createdPurchaseItems[0]).toMatchObject({
      totalBaseUnits: 60,
      unitCost: 45,
    });
  });

  it('defaults unitsPerPurchaseUnit to 1 when omitted', async () => {
    await service.create({
      items: [
        {
          resourceId: 'mailer',
          purchaseQuantity: 10,
          purchaseUnit: 'PIECE',
          totalCost: 1000,
        },
      ],
    });

    expect(restockCalls[0]).toMatchObject({
      resourceId: 'mailer',
      quantity: 10,
      unitCost: 100,
    });
  });

  it('sums line totals into the purchase totalCost', async () => {
    await service.create({
      items: [
        {
          resourceId: 'film',
          purchaseQuantity: 1,
          purchaseUnit: 'PACK',
          unitsPerPurchaseUnit: 20,
          totalCost: 900,
        },
        {
          resourceId: 'mailer',
          purchaseQuantity: 5,
          purchaseUnit: 'PIECE',
          totalCost: 500,
        },
      ],
    });

    expect(createdPurchaseData.totalCost).toBe(1400);
    expect(restockCalls).toHaveLength(2);
  });

  it('rejects an unknown supplier before touching inventory', async () => {
    await expect(
      service.create({
        supplierId: 'does-not-exist',
        items: [
          {
            resourceId: 'film',
            purchaseQuantity: 1,
            purchaseUnit: 'PACK',
            totalCost: 100,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(NotFoundException);

    expect(restockCalls).toHaveLength(0);
  });

  it('rejects a line item that resolves to zero base units', async () => {
    await expect(
      service.create({
        items: [
          {
            resourceId: 'film',
            purchaseQuantity: 0,
            purchaseUnit: 'PACK',
            unitsPerPurchaseUnit: 20,
            totalCost: 100,
          },
        ],
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
