import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { MovementReason } from '../generated/prisma/enums';
import { PrismaService } from '../prisma/prisma.service';

type AdjustStockInput = {
  resourceId: string;
  quantity: number;
  reason: MovementReason;
  note?: string;
  orderId?: string;
  purchaseId?: string;
  unitCost?: number;
};

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  async adjustStock(input: AdjustStockInput) {
    if (input.quantity === 0) {
      throw new BadRequestException(
        'Stock adjustment quantity cannot be zero',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const resource = await tx.resource.findUnique({
        where: {
          id: input.resourceId,
        },
      });

      if (!resource || !resource.isActive) {
        throw new NotFoundException('Resource was not found');
      }

      const currentStock = Number(resource.currentStock);
      const newStock = currentStock + input.quantity;

      if (newStock < 0) {
        throw new BadRequestException(
          `Insufficient stock for "${resource.name}". Available: ${currentStock}`,
        );
      }

      const updatedResource = await tx.resource.update({
        where: {
          id: input.resourceId,
        },
        data: {
          currentStock: newStock,
        },
      });

      const movement = await tx.resourceMovement.create({
        data: {
          resourceId: input.resourceId,
          quantity: input.quantity,
          unitCost: input.unitCost ?? resource.averageUnitCost,
          reason: input.reason,
          note: input.note,
          orderId: input.orderId,
          purchaseId: input.purchaseId,
        },
      });

      return {
        resource: updatedResource,
        movement,
      };
    });
  }

  async addStock(
    resourceId: string,
    quantity: number,
    options?: {
      note?: string;
      purchaseId?: string;
      unitCost?: number;
    },
  ) {
    if (quantity <= 0) {
      throw new BadRequestException(
        'Stock quantity to add must be greater than zero',
      );
    }

    return this.adjustStock({
      resourceId,
      quantity,
      reason: MovementReason.PURCHASE,
      note: options?.note,
      purchaseId: options?.purchaseId,
      unitCost: options?.unitCost,
    });
  }

  async consumeStock(
    resourceId: string,
    quantity: number,
    options?: {
      note?: string;
      orderId?: string;
    },
  ) {
    if (quantity <= 0) {
      throw new BadRequestException(
        'Stock quantity to consume must be greater than zero',
      );
    }

    return this.adjustStock({
      resourceId,
      quantity: -quantity,
      reason: MovementReason.ORDER_USAGE,
      note: options?.note,
      orderId: options?.orderId,
    });
  }

  async recordWaste(
    resourceId: string,
    quantity: number,
    note?: string,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException(
        'Waste quantity must be greater than zero',
      );
    }

    return this.adjustStock({
      resourceId,
      quantity: -quantity,
      reason: MovementReason.WASTE,
      note,
    });
  }

  async recordDamage(
    resourceId: string,
    quantity: number,
    note?: string,
  ) {
    if (quantity <= 0) {
      throw new BadRequestException(
        'Damage quantity must be greater than zero',
      );
    }

    return this.adjustStock({
      resourceId,
      quantity: -quantity,
      reason: MovementReason.DAMAGE,
      note,
    });
  }
}