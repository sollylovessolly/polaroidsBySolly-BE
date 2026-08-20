import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';

import { ConsumptionRule, ProductCategory } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';
import { InventoryAvailabilityService } from './inventory-availability.service';
import { PhoneCasePackage } from './order-item-calculation';

/*
 * These tests exercise the inventory availability engine in isolation by
 * mocking PrismaService. They cover the business scenarios documented for
 * PolaroidsBySolly:
 *
 * - film / box limits for polaroids (PER_UNIT + CAPACITY)
 * - per-model phone-case stock
 * - unlimited outsourced variants
 * - order-level packaging validation
 * - duplicate SKU combination
 * - inactive resources
 */

type MockResource = {
  id: string;
  name: string;
  currentStock: number;
  isActive?: boolean;
};

type MockRule = {
  variantId: string;
  resourceId: string;
  rule: ConsumptionRule;
  quantity: number;
  capacity?: number | null;
  usageGroup?: string | null;
  resource: MockResource;
};

function buildResource(resource: MockResource) {
  return {
    id: resource.id,
    name: resource.name,
    currentStock: resource.currentStock,
    isActive: resource.isActive ?? true,
  };
}

function buildRule(rule: MockRule) {
  return {
    variantId: rule.variantId,
    resourceId: rule.resourceId,
    rule: rule.rule,
    quantity: rule.quantity,
    capacity: rule.capacity ?? null,
    usageGroup: rule.usageGroup ?? null,
    resource: buildResource(rule.resource),
  };
}

describe('InventoryAvailabilityService', () => {
  let service: InventoryAvailabilityService;

  const productResourceRuleFindMany = jest.fn();
  const orderResourceRuleFindMany = jest.fn();
  const resourceFindMany = jest.fn();

  const prismaMock = {
    productResourceRule: {
      findMany: productResourceRuleFindMany,
    },
    orderResourceRule: {
      findMany: orderResourceRuleFindMany,
    },
    resource: {
      findMany: resourceFindMany,
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    // Default: no order-level packaging rules unless a test sets them.
    orderResourceRuleFindMany.mockResolvedValue([]);
    resourceFindMany.mockResolvedValue([]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        InventoryAvailabilityService,
        {
          provide: PrismaService,
          useValue: prismaMock,
        },
      ],
    }).compile();

    service = module.get<InventoryAvailabilityService>(
      InventoryAvailabilityService,
    );
  });

  describe('phone-case packages', () => {
    it('prices and validates the required package option', () => {
      expect(
        service.calculateUnitPrice(5500, ProductCategory.PHONE_CASE, {
          package: PhoneCasePackage.CASE_ONLY,
        }),
      ).toBe(5500);
      expect(
        service.calculateUnitPrice(5500, ProductCategory.PHONE_CASE, {
          package: PhoneCasePackage.WITH_POLAROID,
        }),
      ).toBe(9000);
      expect(() =>
        service.calculateUnitPrice(5500, ProductCategory.PHONE_CASE, {
          package: 'FRONTEND_PRICE_1',
        }),
      ).toThrow(BadRequestException);
    });

    it('combines regular and phone-case prints in one box capacity group', async () => {
      const film = {
        id: 'film',
        sku: 'FILM-SHEET',
        name: 'Instax Mini Film Sheet',
        currentStock: 30,
        isActive: true,
      };
      const box = {
        id: 'box',
        sku: 'POLAROID-BOX',
        name: 'Polaroid Box',
        currentStock: 2,
        isActive: true,
      };
      resourceFindMany.mockResolvedValue([film, box]);
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          usageGroup: 'POLAROID_PRINT',
          resource: film,
        }),
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          usageGroup: 'POLAROID_PRINT',
          resource: box,
        }),
        buildRule({
          variantId: 'phone',
          resourceId: 'blank',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'blank',
            name: 'Blank iPhone Case',
            currentStock: 10,
          },
        }),
        buildRule({
          variantId: 'phone',
          resourceId: 'card',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: { id: 'card', name: 'Phone Case Card', currentStock: 10 },
        }),
      ]);

      const requirements = await service.assertOrderAvailability([
        {
          variantId: 'polaroid',
          variantSku: 'POLAROID-STANDARD',
          productCategory: ProductCategory.POLAROID,
          quantity: 10,
        },
        {
          variantId: 'phone',
          variantSku: 'PHONECASE-IPHONE-15-PRO',
          productCategory: ProductCategory.PHONE_CASE,
          quantity: 10,
          customization: { package: PhoneCasePackage.WITH_POLAROID },
        },
      ]);

      expect(
        requirements.find((item) => item.resourceId === 'film')
          ?.requiredQuantity,
      ).toBe(20);
      expect(
        requirements.find((item) => item.resourceId === 'box')
          ?.requiredQuantity,
      ).toBe(1);
      expect(
        requirements.find((item) => item.resourceId === 'blank')
          ?.requiredQuantity,
      ).toBe(10);
      expect(
        requirements.find((item) => item.resourceId === 'card')
          ?.requiredQuantity,
      ).toBe(10);
    });

    it('keeps mixed packages separate while combining their base resources', async () => {
      const film = {
        id: 'film',
        sku: 'FILM-SHEET',
        name: 'Instax Mini Film Sheet',
        currentStock: 5,
        isActive: true,
      };
      const box = {
        id: 'box',
        sku: 'POLAROID-BOX',
        name: 'Polaroid Box',
        currentStock: 1,
        isActive: true,
      };
      resourceFindMany.mockResolvedValue([film, box]);
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'phone',
          resourceId: 'blank',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: { id: 'blank', name: 'Blank Case', currentStock: 2 },
        }),
        buildRule({
          variantId: 'phone',
          resourceId: 'card',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: { id: 'card', name: 'Phone Case Card', currentStock: 2 },
        }),
      ]);

      const base = {
        variantId: 'phone',
        variantSku: 'PHONECASE-IPHONE-15-PRO',
        productCategory: ProductCategory.PHONE_CASE,
        quantity: 1,
      };
      const requirements = await service.assertOrderAvailability([
        { ...base, customization: { package: PhoneCasePackage.CASE_ONLY } },
        { ...base, customization: { package: PhoneCasePackage.WITH_POLAROID } },
      ]);

      expect(
        requirements.find((item) => item.resourceId === 'blank')
          ?.requiredQuantity,
      ).toBe(2);
      expect(
        requirements.find((item) => item.resourceId === 'card')
          ?.requiredQuantity,
      ).toBe(2);
      expect(
        requirements.find((item) => item.resourceId === 'film')
          ?.requiredQuantity,
      ).toBe(1);
    });
  });

  describe('getVariantAvailability', () => {
    it('TEST 1 — zero film: polaroid is out of stock', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          usageGroup: 'POLAROID_PRINT',
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 0,
          },
        }),
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          usageGroup: 'POLAROID_PRINT',
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 10,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['polaroid']);

      expect(map.get('polaroid')).toEqual({
        inStock: false,
        availableQuantity: 0,
        reasonIfUnavailable: 'Instax Mini Film Sheet',
      });
    });

    it('TEST 2 — limited film caps availability at 3', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 3,
          },
        }),
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 10,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['polaroid']);

      expect(map.get('polaroid')).toEqual({
        inStock: true,
        availableQuantity: 3,
        reasonIfUnavailable: null,
      });
    });

    it('TEST 3 — capacity limit: 1 box supports 20 prints', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 100,
          },
        }),
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 1,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['polaroid']);

      expect(map.get('polaroid')?.availableQuantity).toBe(20);
      expect(map.get('polaroid')?.inStock).toBe(true);
    });

    it('TEST 4 — combined limiting rules pick the most restrictive (13)', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 13,
          },
        }),
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 5,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['polaroid']);

      // film supports 13, boxes support 100 -> 13 wins
      expect(map.get('polaroid')?.availableQuantity).toBe(13);
    });

    it('TEST 5 — phone cases are independent per model', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'ip15pro',
          resourceId: 'blank-ip15pro',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'blank-ip15pro',
            name: 'Blank iPhone 15 Pro Case',
            currentStock: 0,
          },
        }),
        buildRule({
          variantId: 'ip15',
          resourceId: 'blank-ip15',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'blank-ip15',
            name: 'Blank iPhone 15 Case',
            currentStock: 4,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['ip15pro', 'ip15']);

      expect(map.get('ip15pro')?.inStock).toBe(false);
      expect(map.get('ip15')?.inStock).toBe(true);
      expect(map.get('ip15')?.availableQuantity).toBe(4);
    });

    it('TEST 6 — variant with no limiting rule is unlimited', async () => {
      productResourceRuleFindMany.mockResolvedValue([]);

      const map = await service.getVariantAvailability(['photostrip-1']);

      expect(map.get('photostrip-1')).toEqual({
        inStock: true,
        availableQuantity: null,
        reasonIfUnavailable: null,
      });
    });

    it('TEST 10 — inactive required resource marks variant unavailable', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 100,
            isActive: false,
          },
        }),
      ]);

      const map = await service.getVariantAvailability(['polaroid']);

      expect(map.get('polaroid')).toEqual({
        inStock: false,
        availableQuantity: 0,
        reasonIfUnavailable: 'Instax Mini Film Sheet',
      });
    });

    it('returns an empty map when given no variant IDs', async () => {
      const map = await service.getVariantAvailability([]);

      expect(map.size).toBe(0);
      expect(productResourceRuleFindMany).not.toHaveBeenCalled();
    });
  });

  describe('assertOrderAvailability', () => {
    it('TEST 2 — allows an order for exactly the available film (3)', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 3,
          },
        }),
      ]);

      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 3,
          },
        ]),
      ).resolves.toBeDefined();
    });

    it('TEST 2 — rejects an order beyond available film (4)', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 3,
          },
        }),
      ]);

      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 4,
          },
        ]),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('TEST 7 — rejects an order when mandatory packaging is out of stock', async () => {
      productResourceRuleFindMany.mockResolvedValue([]);

      orderResourceRuleFindMany.mockResolvedValue([
        {
          resourceId: 'mailer',
          quantity: 1,
          isActive: true,
          resource: buildResource({
            id: 'mailer',
            name: 'Mailer Bag',
            currentStock: 0,
          }),
        },
      ]);

      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'photostrip-1',
            variantSku: 'PHOTOSTRIP-1',
            quantity: 1,
          },
        ]),
      ).rejects.toThrow('Mailer Bag');
    });

    it('TEST 8 — combines duplicate SKUs into a single total (5)', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 4,
          },
        }),
      ]);

      // 2 + 3 = 5 required, only 4 in stock -> reject
      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 2,
          },
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 3,
          },
        ]),
      ).rejects.toThrow('Required: 5, available: 4');
    });

    it('TEST 10 — rejects an order that requires an inactive resource', async () => {
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'film',
          rule: ConsumptionRule.PER_UNIT,
          quantity: 1,
          resource: {
            id: 'film',
            name: 'Instax Mini Film Sheet',
            currentStock: 100,
            isActive: false,
          },
        }),
      ]);

      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 1,
          },
        ]),
      ).rejects.toThrow('Instax Mini Film Sheet is currently unavailable');
    });

    it('charges a FIXED resource once per SKU even across duplicate lines', async () => {
      // A vintage-letter wax seal is a one-off per SKU. Two lines of the
      // same SKU must still only need 1 seal, so stock of 1 is enough.
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'letter',
          resourceId: 'wax-seal',
          rule: ConsumptionRule.FIXED,
          quantity: 1,
          resource: {
            id: 'wax-seal',
            name: 'Wax Seal',
            currentStock: 1,
          },
        }),
      ]);

      const requirements = await service.assertOrderAvailability([
        {
          variantId: 'letter',
          variantSku: 'VINTAGE-LETTER',
          quantity: 1,
        },
        {
          variantId: 'letter',
          variantSku: 'VINTAGE-LETTER',
          quantity: 1,
        },
      ]);

      const waxSeal = requirements.find(
        (requirement) => requirement.resourceId === 'wax-seal',
      );

      expect(waxSeal?.requiredQuantity).toBe(1);
    });

    it('combines usageGroup capacity across shared variants', async () => {
      // Two variants share the POLAROID_PRINT box capacity. 21 prints
      // across the group need 2 boxes; only 1 is available -> reject.
      productResourceRuleFindMany.mockResolvedValue([
        buildRule({
          variantId: 'polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          usageGroup: 'POLAROID_PRINT',
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 1,
          },
        }),
        buildRule({
          variantId: 'case-polaroid',
          resourceId: 'box',
          rule: ConsumptionRule.CAPACITY,
          quantity: 1,
          capacity: 20,
          usageGroup: 'POLAROID_PRINT',
          resource: {
            id: 'box',
            name: 'Polaroid Box',
            currentStock: 1,
          },
        }),
      ]);

      await expect(
        service.assertOrderAvailability([
          {
            variantId: 'polaroid',
            variantSku: 'POLAROID-STANDARD',
            quantity: 11,
          },
          {
            variantId: 'case-polaroid',
            variantSku: 'PHONECASE-POLAROID',
            quantity: 10,
          },
        ]),
      ).rejects.toThrow('Polaroid Box');
    });
  });
});
