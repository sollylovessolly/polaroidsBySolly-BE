import {
  Injectable,
  NotFoundException,
} from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateOrderDto } from './dto/create-order.dto';

@Injectable()
export class OrdersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createOrderDto: CreateOrderDto) {
    return this.prisma.$transaction(async (tx) => {
      const customer = await this.findOrCreateCustomer(
        tx,
        createOrderDto.customer,
      );

      const variants = await Promise.all(
        createOrderDto.items.map(async (item) => {
          const variant = await tx.productVariant.findUnique({
            where: {
              id: item.variantId,
            },
          });

          if (!variant || !variant.isActive) {
            throw new NotFoundException(
              `Variant with ID "${item.variantId}" was not found`,
            );
          }

          return {
            variant,
            quantity: item.quantity,
            customization: item.customization,
          };
        }),
      );

      const subtotal = variants.reduce((total, item) => {
        return (
          total +
          Number(item.variant.sellingPrice) * item.quantity
        );
      }, 0);

      const order = await tx.order.create({
        data: {
          orderNumber: `PBS-${Date.now()}`,
          customerId: customer.id,
          source: createOrderDto.source,

          subtotal,
          deliveryFee: 0,
          discount: 0,
          totalAmount: subtotal,

          deliveryState: createOrderDto.delivery.state,
          deliveryAddress: createOrderDto.delivery.address,

          customerNote: createOrderDto.customerNote,

          revenueSnapshot: subtotal,
        },
      });

      await tx.orderItem.createMany({
        data: variants.map((item) => ({
          orderId: order.id,
          variantId: item.variant.id,
          quantity: item.quantity,

          unitPriceSnapshot: item.variant.sellingPrice,

          totalPriceSnapshot:
            Number(item.variant.sellingPrice) *
            item.quantity,

          outsourcedCostSnapshot:
            Number(item.variant.outsourcedUnitCost) *
            item.quantity,

          materialCostSnapshot: 0,

          customization:
            item.customization as Prisma.InputJsonValue | undefined,
        })),
      });

      return tx.order.findUnique({
        where: {
          id: order.id,
        },
        include: {
          customer: true,
          items: {
            include: {
              variant: {
                include: {
                  product: true,
                },
              },
            },
          },
        },
      });
    });
  }

  async findAll() {
    return this.prisma.order.findMany({
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async findOne(id: string) {
    const order = await this.prisma.order.findUnique({
      where: {
        id,
      },
      include: {
        customer: true,
        items: {
          include: {
            variant: {
              include: {
                product: true,
              },
            },
          },
        },
        payments: true,
        statusHistory: {
          orderBy: {
            changedAt: 'desc',
          },
        },
      },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID "${id}" was not found`,
      );
    }

    return order;
  }

  private async findOrCreateCustomer(
    tx: Prisma.TransactionClient,
    customer: CreateOrderDto['customer'],
  ) {
    const existingCustomer = await tx.customer.findFirst({
      where: {
        phone: customer.phone,
      },
    });

    if (existingCustomer) {
      return existingCustomer;
    }

    return tx.customer.create({
      data: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email,
      },
    });
  }
}