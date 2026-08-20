import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MovementReason, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async restockResource(
    resourceId: string,
    quantity: number,
    unitCost: number,
    note?: string,
  ) {
    return this.prisma.$transaction(
      async (tx) =>
        this.applyResourceRestock(tx, {
          resourceId,
          quantity,
          unitCost,
          note,
        }),
      {
        maxWait: 15_000,
        timeout: 30_000,
      },
    );
  }

  /**
   * Adds stock for a single resource and records the movement.
   *
   * This is the single reusable "add stock" primitive. It is transaction
   * aware so it can be called on its own (via restockResource) or as one
   * step inside a larger purchase transaction (via PurchasesService). It
   * never opens its own transaction, so a caller can restock several
   * resources atomically.
   *
   * The average unit cost is updated with weighted-average costing:
   *
   *   newAverage =
   *     (oldStock × oldAverage + addedQuantity × unitCost)
   *     ────────────────────────────────────────────────
   *                    oldStock + addedQuantity
   *
   * If the resource previously had zero stock, the new average simply
   * becomes the incoming unit cost.
   */
  async applyResourceRestock(
    tx: Prisma.TransactionClient,
    params: {
      resourceId: string;
      quantity: number;
      unitCost: number;
      purchaseId?: string;
      reason?: MovementReason;
      note?: string;
    },
  ) {
    const { resourceId, quantity, unitCost } = params;

    if (!Number.isFinite(quantity) || quantity <= 0) {
      throw new BadRequestException(
        'Restock quantity must be greater than zero',
      );
    }

    if (!Number.isFinite(unitCost) || unitCost < 0) {
      throw new BadRequestException('Unit cost cannot be negative');
    }

    const resource = await tx.resource.findUnique({
      where: {
        id: resourceId,
      },
    });

    if (!resource || !resource.isActive) {
      throw new NotFoundException(
        `Resource with ID "${resourceId}" was not found`,
      );
    }

    const oldStock = Number(resource.currentStock);

    const oldAverageCost = Number(resource.averageUnitCost);

    const newStock = oldStock + quantity;

    const newAverageCost =
      newStock === 0
        ? 0
        : (oldStock * oldAverageCost + quantity * unitCost) / newStock;

    if (!Number.isFinite(newAverageCost)) {
      throw new BadRequestException('Calculated average unit cost is invalid');
    }

    const updatedResource = await tx.resource.update({
      where: {
        id: resource.id,
      },
      data: {
        currentStock: newStock,
        averageUnitCost: newAverageCost,
      },
    });

    const movement = await tx.resourceMovement.create({
      data: {
        resourceId: resource.id,
        quantity,
        unitCost,
        reason: params.reason ?? MovementReason.PURCHASE,
        purchaseId: params.purchaseId,
        note: params.note ?? `Restocked ${quantity} ${resource.unit}`,
      },
    });

    return {
      resource: updatedResource,
      movement,
    };
  }

  async consumeResource(
    tx: Prisma.TransactionClient,
    resourceId: string,
    quantity: number,
    orderId: string,
    note?: string,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException(
        'Inventory quantity must be greater than zero',
      );
    }

    const resource = await tx.resource.findUnique({
      where: {
        id: resourceId,
      },
    });

    if (!resource || !resource.isActive) {
      throw new NotFoundException(
        `Resource with ID "${resourceId}" was not found`,
      );
    }

    const currentStock = Number(resource.currentStock);

    if (currentStock < quantity) {
      throw new BadRequestException(
        `Not enough ${resource.name}. Available: ${currentStock}, required: ${quantity}`,
      );
    }

    const unitCost = Number(resource.averageUnitCost);

    await tx.resource.update({
      where: {
        id: resource.id,
      },
      data: {
        currentStock: {
          decrement: quantity,
        },
      },
    });

    await tx.resourceMovement.create({
      data: {
        resourceId: resource.id,
        orderId,
        quantity: -quantity,
        unitCost,
        reason: MovementReason.ORDER_USAGE,
        note: note ?? `Consumed for order ${orderId}`,
      },
    });

    return {
      resourceId: resource.id,
      resourceName: resource.name,
      category: resource.category,
      quantity,
      unitCost,
      totalCost: unitCost * quantity,
    };
  }
}
