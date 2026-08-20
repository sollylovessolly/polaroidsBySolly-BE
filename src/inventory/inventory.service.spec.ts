/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';

import { InventoryService } from './inventory.service';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Focused tests for the weighted-average costing math in
 * applyResourceRestock. Prisma is mocked; we only assert on the
 * values written back to the resource and movement.
 */
describe('InventoryService.applyResourceRestock', () => {
  let service: InventoryService;

  let resourceRecord: any;
  let updateData: any;
  let movementData: any;

  const makeTx = () => ({
    resource: {
      findUnique: jest.fn(async () => resourceRecord),
      update: jest.fn(async ({ data }: any) => {
        updateData = data;
        return { ...resourceRecord, ...data };
      }),
    },
    resourceMovement: {
      create: jest.fn(async ({ data }: any) => {
        movementData = data;
        return data;
      }),
    },
  });

  beforeEach(async () => {
    updateData = undefined;
    movementData = undefined;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<InventoryService>(InventoryService);
  });

  it('sets the average to the incoming cost when starting from zero stock', async () => {
    resourceRecord = {
      id: 'film',
      isActive: true,
      unit: 'SHEET',
      currentStock: 0,
      averageUnitCost: 0,
    };

    const tx = makeTx();

    await service.applyResourceRestock(tx as any, {
      resourceId: 'film',
      quantity: 60,
      unitCost: 45,
    });

    expect(updateData.currentStock).toBe(60);
    expect(updateData.averageUnitCost).toBe(45);
    expect(movementData.quantity).toBe(60);
    expect(movementData.reason).toBe('PURCHASE');
  });

  it('blends old and new cost with weighted average', async () => {
    // 40 sheets already on hand at ₦50 each.
    resourceRecord = {
      id: 'film',
      isActive: true,
      unit: 'SHEET',
      currentStock: 40,
      averageUnitCost: 50,
    };

    const tx = makeTx();

    // Add 60 sheets at ₦45 each.
    await service.applyResourceRestock(tx as any, {
      resourceId: 'film',
      quantity: 60,
      unitCost: 45,
    });

    // (40×50 + 60×45) / 100 = (2000 + 2700) / 100 = 47.
    expect(updateData.currentStock).toBe(100);
    expect(updateData.averageUnitCost).toBe(47);
  });

  it('links the movement to a purchase when purchaseId is provided', async () => {
    resourceRecord = {
      id: 'film',
      isActive: true,
      unit: 'SHEET',
      currentStock: 0,
      averageUnitCost: 0,
    };

    const tx = makeTx();

    await service.applyResourceRestock(tx as any, {
      resourceId: 'film',
      quantity: 10,
      unitCost: 100,
      purchaseId: 'purchase-1',
    });

    expect(movementData.purchaseId).toBe('purchase-1');
  });

  it('rejects a non-positive quantity', async () => {
    resourceRecord = {
      id: 'film',
      isActive: true,
      unit: 'SHEET',
      currentStock: 0,
      averageUnitCost: 0,
    };

    const tx = makeTx();

    await expect(
      service.applyResourceRestock(tx as any, {
        resourceId: 'film',
        quantity: 0,
        unitCost: 100,
      }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('throws when the resource does not exist', async () => {
    resourceRecord = null;

    const tx = makeTx();

    await expect(
      service.applyResourceRestock(tx as any, {
        resourceId: 'missing',
        quantity: 10,
        unitCost: 100,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
