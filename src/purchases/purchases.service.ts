import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreatePurchaseDto } from './dto/create-purchase.dto';
import { PurchaseFiltersDto } from './dto/purchase-filters.dto';
import { paginated, pagination } from '../common/dto/pagination.dto';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class PurchasesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
  ) {}

  /**
   * Records a purchase and restocks every resource it contains, atomically.
   *
   * A purchase is a real-world buying event ("I bought 3 packs of film and
   * 2 boxes of mailers"). For each line item we:
   *   1. convert the purchased quantity into base units,
   *   2. derive the per-base-unit cost,
   *   3. add that stock to the resource using weighted-average costing, and
   *   4. record a stock movement linked back to this purchase.
   *
   * Everything runs inside a single transaction so a purchase either lands
   * completely (purchase row + items + movements + updated balances) or not
   * at all.
   */
  async create(dto: CreatePurchaseDto) {
    if (dto.supplierId) {
      const supplier = await this.prisma.supplier.findUnique({
        where: { id: dto.supplierId },
      });

      if (!supplier || !supplier.isActive) {
        throw new NotFoundException(
          `Supplier with ID "${dto.supplierId}" was not found`,
        );
      }
    }

    // Pre-compute each line item's derived numbers before opening the
    // transaction so validation errors fail fast and cheaply.
    const computedItems = dto.items.map((item) => {
      const unitsPerPurchaseUnit = item.unitsPerPurchaseUnit ?? 1;

      const totalBaseUnits = item.purchaseQuantity * unitsPerPurchaseUnit;

      if (totalBaseUnits <= 0) {
        throw new BadRequestException(
          'Each purchase item must add more than zero base units',
        );
      }

      const unitCost = item.totalCost / totalBaseUnits;

      return {
        resourceId: item.resourceId,
        purchaseQuantity: item.purchaseQuantity,
        purchaseUnit: item.purchaseUnit,
        unitsPerPurchaseUnit,
        totalBaseUnits,
        totalCost: item.totalCost,
        unitCost,
      };
    });

    const totalCost = computedItems.reduce(
      (sum, item) => sum + item.totalCost,
      0,
    );

    return this.prisma.$transaction(
      async (tx) => {
        const purchase = await tx.purchase.create({
          data: {
            supplierId: dto.supplierId,
            totalCost,
            note: dto.note,
            purchasedAt: dto.purchasedAt
              ? new Date(dto.purchasedAt)
              : undefined,
          },
        });

        for (const item of computedItems) {
          await tx.purchaseItem.create({
            data: {
              purchaseId: purchase.id,
              resourceId: item.resourceId,
              purchaseQuantity: item.purchaseQuantity,
              purchaseUnit: item.purchaseUnit,
              unitsPerPurchaseUnit: item.unitsPerPurchaseUnit,
              totalBaseUnits: item.totalBaseUnits,
              totalCost: item.totalCost,
              unitCost: item.unitCost,
            },
          });

          // Reuse the shared inventory primitive: this updates the cached
          // stock balance with weighted-average costing and writes a
          // PURCHASE movement linked to this purchase.
          await this.inventoryService.applyResourceRestock(tx, {
            resourceId: item.resourceId,
            quantity: item.totalBaseUnits,
            unitCost: item.unitCost,
            purchaseId: purchase.id,
            note: `Purchase ${purchase.id}`,
          });
        }

        return tx.purchase.findUnique({
          where: { id: purchase.id },
          include: {
            supplier: true,
            items: {
              include: {
                resource: true,
              },
            },
          },
        });
      },
      {
        maxWait: 15_000,
        timeout: 30_000,
      },
    );
  }

  async findAll(filters: PurchaseFiltersDto = {}) {
    const where: Prisma.PurchaseWhereInput = {
      supplierId: filters.supplierId,
      ...(filters.from || filters.to
        ? { purchasedAt: { gte: filters.from, lte: filters.to } }
        : {}),
    };
    const { page, limit, skip, take } = pagination(filters);
    const [data, total] = await Promise.all([
      this.prisma.purchase.findMany({
        where,
        orderBy: {
          purchasedAt: 'desc',
        },
        include: {
          supplier: true,
          items: {
            include: {
              resource: true,
            },
          },
        },
        skip,
        take,
      }),
      this.prisma.purchase.count({ where }),
    ]);
    return paginated(data, total, page, limit);
  }

  async findOne(id: string) {
    const purchase = await this.prisma.purchase.findUnique({
      where: { id },
      include: {
        supplier: true,
        items: {
          include: {
            resource: true,
          },
        },
        movements: true,
      },
    });

    if (!purchase) {
      throw new NotFoundException(`Purchase with ID "${id}" was not found`);
    }

    return purchase;
  }
}
