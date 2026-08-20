import { BadRequestException, Injectable } from '@nestjs/common';

import {
  ConsumptionRule,
  Prisma,
  ProductCategory,
} from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  CalculatedOrderItemInput,
  PHONE_CASE_POLAROID_ADD_ON_PRICE,
  PhoneCasePackage,
} from './order-item-calculation';

type DatabaseClient = PrismaService | Prisma.TransactionClient;

export type ResourceRequirement = {
  resourceId: string;
  resourceName: string;
  requiredQuantity: number;
  currentStock: number;
};

export type VariantAvailability = {
  inStock: boolean;
  availableQuantity: number | null;
  reasonIfUnavailable: string | null;
};

@Injectable()
export class InventoryAvailabilityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Per-variant availability for the product catalogue.
   *
   * Only the physical ProductResourceRules that limit a variant are
   * considered here. Order-level packaging (mailer bags, stickers, etc.)
   * is intentionally NOT included so that a single shared packaging
   * resource running low does not mark every product globally
   * unavailable. Order-level packaging is validated at order creation
   * and payment confirmation instead.
   */
  async getVariantAvailability(
    variantIds: string[],
  ): Promise<Map<string, VariantAvailability>> {
    const availabilityMap = new Map<string, VariantAvailability>();

    if (variantIds.length === 0) {
      return availabilityMap;
    }

    const rules = await this.prisma.productResourceRule.findMany({
      where: {
        variantId: {
          in: variantIds,
        },
      },
      include: {
        resource: true,
      },
    });

    for (const variantId of variantIds) {
      const variantRules = rules.filter((rule) => rule.variantId === variantId);

      /*
       * No inventory rule means the variant is not
       * limited by a physical resource.
       *
       * Example:
       * outsourced photostrips or letters.
       */
      if (variantRules.length === 0) {
        availabilityMap.set(variantId, {
          inStock: true,
          availableQuantity: null,
          reasonIfUnavailable: null,
        });

        continue;
      }

      let availableQuantity = Number.MAX_SAFE_INTEGER;

      let unavailableResource: string | null = null;

      for (const rule of variantRules) {
        /*
         * An inactive required resource makes the
         * variant unavailable regardless of stock.
         */
        if (!rule.resource.isActive) {
          availableQuantity = 0;
          unavailableResource = rule.resource.name;
          break;
        }

        const stock = Number(rule.resource.currentStock);

        const quantitySupported = this.calculateSupportedQuantity(
          rule.rule,
          Number(rule.quantity),
          rule.capacity,
          stock,
        );

        if (quantitySupported < availableQuantity) {
          availableQuantity = quantitySupported;
        }

        if (quantitySupported <= 0 && !unavailableResource) {
          unavailableResource = rule.resource.name;
        }
      }

      availabilityMap.set(variantId, {
        inStock: availableQuantity > 0,

        availableQuantity:
          availableQuantity === Number.MAX_SAFE_INTEGER
            ? null
            : availableQuantity,

        reasonIfUnavailable:
          availableQuantity <= 0 ? unavailableResource : null,
      });
    }

    return availabilityMap;
  }

  /**
   * Validates that current stock can satisfy an entire order.
   *
   * This is read-only. It never deducts stock. It is called at order
   * creation (to reject impossible orders early) and can be reused at
   * payment time before the real deduction happens. Duplicate variants
   * are combined so repeated SKUs are treated as a single total.
   */
  async assertOrderAvailability(
    items: CalculatedOrderItemInput[],
    client?: DatabaseClient,
  ) {
    const db = client ?? this.prisma;

    const combinedItems = new Map<string, CalculatedOrderItemInput>();

    for (const item of items) {
      const rawPackage =
        item.customization && typeof item.customization === 'object'
          ? (item.customization as Record<string, unknown>).package
          : undefined;
      const packageKey =
        item.productCategory === ProductCategory.PHONE_CASE &&
        typeof rawPackage === 'string'
          ? rawPackage
          : '';
      const itemKey = `${item.variantId}:${packageKey}`;
      const existing = combinedItems.get(itemKey);

      if (existing) {
        existing.quantity += item.quantity;
      } else {
        combinedItems.set(itemKey, {
          ...item,
        });
      }
    }

    const itemList = Array.from(combinedItems.values());

    const productRules = await db.productResourceRule.findMany({
      where: {
        variantId: {
          in: itemList.map((item) => item.variantId),
        },
      },
      include: {
        resource: true,
      },
    });

    const orderRules = await db.orderResourceRule.findMany({
      where: {
        isActive: true,
      },
      include: {
        resource: true,
      },
    });

    const phoneCasePolaroidQuantity = itemList.reduce((total, item) => {
      if (item.productCategory !== ProductCategory.PHONE_CASE) {
        return total;
      }

      const packageOption = this.getPhoneCasePackage(item.customization);
      return packageOption === PhoneCasePackage.WITH_POLAROID
        ? total + item.quantity
        : total;
    }, 0);

    if (phoneCasePolaroidQuantity > 0) {
      const addOnResources = await db.resource.findMany({
        where: {
          sku: { in: ['FILM-SHEET', 'POLAROID-BOX'] },
        },
      });
      const film = addOnResources.find(
        (resource) => resource.sku === 'FILM-SHEET',
      );
      const box = addOnResources.find(
        (resource) => resource.sku === 'POLAROID-BOX',
      );

      if (!film?.isActive) {
        throw new BadRequestException(
          'Instax Mini Film Sheet is currently unavailable',
        );
      }
      if (!box?.isActive) {
        throw new BadRequestException('Polaroid Box is currently unavailable');
      }

      productRules.push(
        {
          id: '__PHONE_CASE_POLAROID_FILM_RULE__',
          variantId: '__PHONE_CASE_POLAROID_ADD_ON__',
          resourceId: film.id,
          rule: ConsumptionRule.PER_UNIT,
          quantity: new Prisma.Decimal(1),
          capacity: null,
          usageGroup: 'POLAROID_PRINT',
          resource: film,
        },
        {
          id: '__PHONE_CASE_POLAROID_BOX_RULE__',
          variantId: '__PHONE_CASE_POLAROID_ADD_ON__',
          resourceId: box.id,
          rule: ConsumptionRule.CAPACITY,
          quantity: new Prisma.Decimal(1),
          capacity: 20,
          usageGroup: 'POLAROID_PRINT',
          resource: box,
        },
      );

      itemList.push({
        variantId: '__PHONE_CASE_POLAROID_ADD_ON__',
        variantSku: '__PHONE_CASE_POLAROID_ADD_ON__',
        productCategory: ProductCategory.PHONE_CASE,
        quantity: phoneCasePolaroidQuantity,
        customization: { package: PhoneCasePackage.CASE_ONLY },
      });
    }

    const requirements = new Map<string, ResourceRequirement>();

    /*
     * FIXED rules are a one-off per SKU, not per line. Track which
     * (variant, resource) FIXED pairs have already been counted so a
     * repeated SKU across lines is only charged once. This mirrors the
     * payment-time deduction in PaymentsService.confirmPayment.
     */
    const countedFixedRules = new Set<string>();

    const groupedRules = new Map<
      string,
      {
        resourceId: string;
        resourceName: string;
        currentStock: number;
        rule: ConsumptionRule;
        quantity: number;
        capacity: number | null;
        totalItemQuantity: number;
      }
    >();

    for (const item of itemList) {
      const rulesForVariant = productRules.filter(
        (rule) => rule.variantId === item.variantId,
      );

      for (const rule of rulesForVariant) {
        if (!rule.resource.isActive) {
          throw new BadRequestException(
            `${rule.resource.name} is currently unavailable`,
          );
        }

        /*
         * Rules with a usageGroup are combined.
         *
         * Example:
         * Regular Polaroids and phone-case Polaroids
         * can share POLAROID_PRINT packaging capacity.
         */
        if (rule.usageGroup) {
          const key = [
            rule.resourceId,
            rule.usageGroup,
            rule.rule,
            rule.capacity ?? '',
            rule.quantity.toString(),
          ].join(':');

          const existing = groupedRules.get(key);

          if (existing) {
            existing.totalItemQuantity += item.quantity;
          } else {
            groupedRules.set(key, {
              resourceId: rule.resourceId,
              resourceName: rule.resource.name,
              currentStock: Number(rule.resource.currentStock),
              rule: rule.rule,
              quantity: Number(rule.quantity),
              capacity: rule.capacity,
              totalItemQuantity: item.quantity,
            });
          }

          continue;
        }

        /*
         * A FIXED rule for a given (variant, resource) is only counted
         * once even if the SKU appears on several lines.
         */
        if (rule.rule === ConsumptionRule.FIXED) {
          const fixedKey = `${rule.variantId}:${rule.resourceId}`;

          if (countedFixedRules.has(fixedKey)) {
            continue;
          }

          countedFixedRules.add(fixedKey);
        }

        const requiredQuantity = this.calculateRequiredQuantity(
          rule.rule,
          Number(rule.quantity),
          rule.capacity,
          item.quantity,
        );

        this.addRequirement(requirements, {
          resourceId: rule.resourceId,
          resourceName: rule.resource.name,
          currentStock: Number(rule.resource.currentStock),
          requiredQuantity,
        });
      }
    }

    for (const groupedRule of groupedRules.values()) {
      const requiredQuantity = this.calculateRequiredQuantity(
        groupedRule.rule,
        groupedRule.quantity,
        groupedRule.capacity,
        groupedRule.totalItemQuantity,
      );

      this.addRequirement(requirements, {
        resourceId: groupedRule.resourceId,
        resourceName: groupedRule.resourceName,
        currentStock: groupedRule.currentStock,
        requiredQuantity,
      });
    }

    /*
     * Mailer, thank-you card, stickers, etc.
     * These are applied once per complete order.
     */
    for (const orderRule of orderRules) {
      if (!orderRule.resource.isActive) {
        throw new BadRequestException(
          `${orderRule.resource.name} is currently unavailable`,
        );
      }

      this.addRequirement(requirements, {
        resourceId: orderRule.resourceId,
        resourceName: orderRule.resource.name,
        currentStock: Number(orderRule.resource.currentStock),
        requiredQuantity: Number(orderRule.quantity),
      });
    }

    for (const requirement of requirements.values()) {
      if (requirement.currentStock < requirement.requiredQuantity) {
        throw new BadRequestException(
          `Not enough ${requirement.resourceName}. Required: ${requirement.requiredQuantity}, available: ${requirement.currentStock}`,
        );
      }
    }

    return Array.from(requirements.values());
  }

  calculateUnitPrice(
    basePrice: number,
    productCategory: ProductCategory,
    customization?: unknown,
  ) {
    if (productCategory !== ProductCategory.PHONE_CASE) {
      return basePrice;
    }

    return (
      basePrice +
      (this.getPhoneCasePackage(customization) ===
      PhoneCasePackage.WITH_POLAROID
        ? PHONE_CASE_POLAROID_ADD_ON_PRICE
        : 0)
    );
  }

  private getPhoneCasePackage(customization: unknown): PhoneCasePackage {
    const packageOption =
      customization && typeof customization === 'object'
        ? (customization as Record<string, unknown>).package
        : undefined;

    if (
      !Object.values(PhoneCasePackage).includes(
        packageOption as PhoneCasePackage,
      )
    ) {
      throw new BadRequestException(
        'Phone-case customization.package must be CASE_ONLY or WITH_POLAROID',
      );
    }

    return packageOption as PhoneCasePackage;
  }

  /**
   * How many finished units a single resource can support given its
   * current stock. This is the single source of truth for the
   * "supply" side of availability.
   */
  private calculateSupportedQuantity(
    rule: ConsumptionRule,
    quantityPerUse: number,
    capacity: number | null,
    stock: number,
  ): number {
    if (rule === ConsumptionRule.PER_UNIT) {
      return quantityPerUse > 0
        ? Math.floor(stock / quantityPerUse)
        : Number.MAX_SAFE_INTEGER;
    }

    if (rule === ConsumptionRule.CAPACITY) {
      const safeCapacity = capacity ?? 1;

      return quantityPerUse > 0
        ? Math.floor(stock / quantityPerUse) * safeCapacity
        : Number.MAX_SAFE_INTEGER;
    }

    if (rule === ConsumptionRule.FIXED) {
      /*
       * A fixed resource is required once for the line item. If there
       * is enough, it does not cap how many units can be made; if not,
       * the variant cannot be fulfilled at all.
       */
      return stock >= quantityPerUse ? Number.MAX_SAFE_INTEGER : 0;
    }

    return Number.MAX_SAFE_INTEGER;
  }

  /**
   * How much of a resource an order needs. This is the single source of
   * truth for the "demand" side of availability.
   */
  private calculateRequiredQuantity(
    rule: ConsumptionRule,
    quantity: number,
    capacity: number | null,
    itemQuantity: number,
  ) {
    if (rule === ConsumptionRule.PER_UNIT) {
      return quantity * itemQuantity;
    }

    if (rule === ConsumptionRule.FIXED) {
      return quantity;
    }

    if (rule === ConsumptionRule.CAPACITY) {
      const safeCapacity = capacity ?? 1;

      return Math.ceil(itemQuantity / safeCapacity) * quantity;
    }

    return 0;
  }

  private addRequirement(
    requirements: Map<string, ResourceRequirement>,
    requirement: ResourceRequirement,
  ) {
    const existing = requirements.get(requirement.resourceId);

    if (existing) {
      existing.requiredQuantity += requirement.requiredQuantity;
      return;
    }

    requirements.set(requirement.resourceId, requirement);
  }
}
