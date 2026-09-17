import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';

import {
  PaymentMethod,
  PaymentStatus,
  Prisma,
  ResourceCategory,
} from '../generated/prisma/client';
import { InventoryAvailabilityService } from '../inventory/inventory-availability.service';
import { InventoryService } from '../inventory/inventory.service';
import { PrismaService } from '../prisma/prisma.service';
import { InitializePaymentDto } from './dto/initialize-payment.dto';
import { VerifyPaymentDto } from './dto/verify-payment.dto';
import { PaystackService, PaystackTransaction } from './paystack.service';
import { PaidOrderNotificationsService } from '../notifications/paid-order-notifications.service';
import { ShippingService } from '../shipping/shipping.service';
import { PaymentFiltersDto } from './dto/payment-filters.dto';
import { paginated, pagination } from '../common/dto/pagination.dto';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly inventoryService: InventoryService,
    private readonly inventoryAvailability: InventoryAvailabilityService,
    private readonly paystack: PaystackService,
    @Optional()
    private readonly notifications?: PaidOrderNotificationsService,
    @Optional()
    private readonly shipping?: ShippingService,
  ) {}

  async initialize(dto: InitializePaymentDto) {
    const order = await this.prisma.order.findUnique({
      where: { id: dto.orderId },
      include: { customer: true },
    });

    if (!order) {
      throw new NotFoundException(
        `Order with ID "${dto.orderId}" was not found`,
      );
    }
    if (order.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This order has already been paid');
    }
    if (!order.customer.email) {
      throw new BadRequestException(
        'Customer email is required to initialize Paystack payment',
      );
    }

    const pending = await this.prisma.paymentAttempt.findUnique({
      where: { orderId: order.id },
    });
    if (pending && pending.expiresAt > new Date()) {
      return {
        authorizationUrl: pending.authorizationUrl,
        accessCode: pending.accessCode,
        reference: pending.reference,
      };
    }

    const initialized = await this.paystack.initializeTransaction({
      email: order.customer.email,
      amount: this.nairaToKobo(order.totalAmount),
      metadata: {
        orderId: order.id,
        orderNumber: order.orderNumber,
        customerId: order.customerId,
      },
    });

    const response = {
      authorizationUrl: initialized.authorization_url,
      accessCode: initialized.access_code,
      reference: initialized.reference,
    };
    await this.prisma.paymentAttempt.upsert({
      where: { orderId: order.id },
      update: {
        reference: response.reference,
        authorizationUrl: response.authorizationUrl,
        accessCode: response.accessCode,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
      create: {
        orderId: order.id,
        reference: response.reference,
        authorizationUrl: response.authorizationUrl,
        accessCode: response.accessCode,
        expiresAt: new Date(Date.now() + 30 * 60_000),
      },
    });
    return response;
  }

  async verify(dto: VerifyPaymentDto) {
    const transaction = await this.paystack.verifyTransaction(dto.reference);
    return this.validateAndConfirm(dto.reference, transaction);
  }

  async handleWebhook(event: {
    event?: string;
    data?: { reference?: string };
  }) {
    if (event.event !== 'charge.success') {
      return { received: true, processed: false };
    }

    const reference = event.data?.reference;
    if (!reference) {
      throw new BadRequestException('Paystack webhook reference is missing');
    }

    const transaction = await this.paystack.verifyTransaction(reference);

    try {
      await this.validateAndConfirm(reference, transaction);
      return { received: true, processed: true };
    } catch (error) {
      if (error instanceof ConflictException) {
        return { received: true, processed: true, fulfillmentBlocked: true };
      }
      throw error;
    }
  }

  async recordManualPayment(input: {
    orderId: string;
    method: PaymentMethod;
    reference?: string;
  }) {
    if (
      input.method !== PaymentMethod.TRANSFER &&
      input.method !== PaymentMethod.OPAY
    ) {
      throw new BadRequestException(
        'Manual payment method must be TRANSFER or OPAY',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: input.orderId },
    });
    if (!order) {
      throw new NotFoundException(
        `Order with ID "${input.orderId}" was not found`,
      );
    }

    const reference =
      input.reference?.trim() || `MANUAL-${input.method}-${order.orderNumber}`;
    const paidAt = new Date();

    try {
      return await this.finalizePaidOrder({
        orderId: order.id,
        reference,
        amountInKobo: this.nairaToKobo(order.totalAmount),
        paidAt,
        method: input.method,
      });
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;
      await this.recordFulfillmentBlockedPayment({
        orderId: order.id,
        reference,
        amountInKobo: this.nairaToKobo(order.totalAmount),
        paidAt,
        method: input.method,
        reason: error.message,
      });
      throw new ConflictException({
        code: 'PAYMENT_RECEIVED_FULFILLMENT_BLOCKED',
        message: `Payment was recorded, but fulfillment is blocked: ${error.message}`,
        paymentReceived: true,
        fulfillmentBlocked: true,
        orderId: order.id,
      });
    }
  }

  async retryBlockedFulfillment(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        payments: {
          where: { status: PaymentStatus.PAID },
          orderBy: { paidAt: 'asc' },
          take: 1,
        },
      },
    });
    if (!order)
      throw new NotFoundException(`Order with ID "${orderId}" was not found`);
    if (order.paymentStatus !== PaymentStatus.PAID || !order.payments[0])
      throw new BadRequestException(
        'No successful payment exists for this order',
      );
    if (order.inventoryDeductedAt)
      return this.prisma.order.findUnique({ where: { id: orderId } });

    const payment = order.payments[0];
    return this.finalizePaidOrder({
      orderId,
      reference: payment.reference ?? `RECOVERY-${payment.id}`,
      amountInKobo: this.nairaToKobo(payment.amount),
      paidAt: payment.paidAt ?? new Date(),
      method: payment.method,
    });
  }

  async findAll(filters: PaymentFiltersDto = {}) {
    const where: Prisma.PaymentWhereInput = {
      method: filters.method,
      status: filters.status,
      ...(filters.from || filters.to
        ? { createdAt: { gte: filters.from, lte: filters.to } }
        : {}),
    };
    const { page, limit, skip, take } = pagination(filters);
    const [data, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        include: { order: { include: { customer: true } } },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.payment.count({ where }),
    ]);
    return paginated(data, total, page, limit);
  }

  async findOne(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      include: {
        order: {
          include: {
            customer: true,
            items: { include: { variant: { include: { product: true } } } },
          },
        },
      },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with ID "${id}" was not found`);
    }
    return payment;
  }

  private async validateAndConfirm(
    requestedReference: string,
    transaction: PaystackTransaction,
  ) {
    if (
      transaction.status !== 'success' ||
      transaction.reference !== requestedReference
    ) {
      throw new BadRequestException('Paystack transaction was not successful');
    }
    if (transaction.currency !== 'NGN') {
      throw new BadRequestException(
        `Payment currency mismatch. Expected NGN, received ${transaction.currency}`,
      );
    }

    const orderId = transaction.metadata?.orderId;
    if (!orderId) {
      throw new BadRequestException(
        'Paystack transaction has no orderId metadata',
      );
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with ID "${orderId}" was not found`);
    }

    const expectedKobo = this.nairaToKobo(order.totalAmount);
    if (transaction.amount !== expectedKobo) {
      throw new BadRequestException(
        `Payment amount mismatch. Expected ${expectedKobo} kobo, received ${transaction.amount} kobo`,
      );
    }

    try {
      return await this.finalizePaidOrder({
        orderId,
        reference: requestedReference,
        amountInKobo: transaction.amount,
        paidAt: transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date(),
        method: PaymentMethod.PAYSTACK,
      });
    } catch (error) {
      if (!(error instanceof BadRequestException)) throw error;

      await this.recordFulfillmentBlockedPayment({
        orderId,
        reference: requestedReference,
        amountInKobo: transaction.amount,
        paidAt: transaction.paid_at
          ? new Date(transaction.paid_at)
          : new Date(),
        method: PaymentMethod.PAYSTACK,
        reason: error.message,
      });
      throw new ConflictException({
        code: 'PAYMENT_RECEIVED_FULFILLMENT_BLOCKED',
        message: `Payment was verified, but fulfillment is blocked: ${error.message}`,
        paymentReceived: true,
        fulfillmentBlocked: true,
        orderId,
      });
    }
  }

  async finalizePaidOrder(input: {
    orderId: string;
    reference: string;
    amountInKobo: number;
    paidAt: Date;
    method: PaymentMethod;
  }) {
    const finalized = await this.prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;

        const existingPayment = await tx.payment.findUnique({
          where: { reference: input.reference },
        });
        if (existingPayment && existingPayment.orderId !== input.orderId) {
          throw new BadRequestException(
            'This payment reference belongs to another order',
          );
        }

        const order = await tx.order.findUnique({
          where: { id: input.orderId },
          include: {
            items: {
              include: { variant: { include: { product: true } } },
            },
          },
        });
        if (!order) {
          throw new NotFoundException(
            `Order with ID "${input.orderId}" was not found`,
          );
        }

        if (
          order.paymentStatus === PaymentStatus.PAID &&
          order.inventoryDeductedAt
        ) {
          if (!existingPayment) {
            await tx.payment.create({
              data: {
                orderId: order.id,
                method: input.method,
                status: PaymentStatus.PAID,
                amount: new Prisma.Decimal(input.amountInKobo).dividedBy(100),
                reference: input.reference,
                paidAt: input.paidAt,
                reconciliationRequired: true,
                reconciliationReason:
                  'Additional successful payment received for an already fulfilled order',
              },
            });
          }
          return {
            order: await this.getOrderResponse(tx, order.id),
            transitioned: false,
          };
        }

        const requirements =
          await this.inventoryAvailability.assertOrderAvailability(
            order.items.map((item) => ({
              variantId: item.variant.id,
              variantSku: item.variant.sku,
              productCategory: item.variant.product.category,
              quantity: item.quantity,
              customization: item.customization,
            })),
            tx,
          );

        let materialCost = 0;
        let packagingCost = 0;
        for (const requirement of requirements) {
          const movement = await this.inventoryService.consumeResource(
            tx,
            requirement.resourceId,
            requirement.requiredQuantity,
            order.id,
            'Verified Paystack order resource usage',
          );
          if (
            movement.category === ResourceCategory.PACKAGING ||
            movement.category === ResourceCategory.CONSUMABLE
          ) {
            packagingCost += movement.totalCost;
          } else {
            materialCost += movement.totalCost;
          }
        }

        const outsourceCost = order.items.reduce(
          (total, item) => total + Number(item.outsourcedCostSnapshot),
          0,
        );
        const revenue = Number(order.totalAmount);
        const deliveryCost = Number(order.actualDeliveryCost);
        const grossProfit =
          revenue - materialCost - packagingCost - outsourceCost - deliveryCost;

        if (!existingPayment) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              method: input.method,
              status: PaymentStatus.PAID,
              amount: new Prisma.Decimal(input.amountInKobo).dividedBy(100),
              reference: input.reference,
              paidAt: input.paidAt,
            },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: {
            paymentStatus: PaymentStatus.PAID,
            paidAt: input.paidAt,
            inventoryDeductedAt: input.paidAt,
            revenueSnapshot: revenue,
            materialCostSnapshot: materialCost,
            packagingCostSnapshot: packagingCost,
            outsourceCostSnapshot: outsourceCost,
            deliveryCostSnapshot: deliveryCost,
            grossProfitSnapshot: grossProfit,
          },
        });

        return {
          order: await this.getOrderResponse(tx, order.id),
          transitioned: true,
        };
      },
      { maxWait: 15_000, timeout: 30_000 },
    );
    if (finalized.transitioned) {
      try {
        await Promise.allSettled([
          this.notifications?.dispatch(input.orderId),
          this.shipping?.attempt(input.orderId),
        ]);
      } catch (error) {
        this.logger.error({
          event: 'paid_order_notifications_failed',
          orderId: input.orderId,
          reference: input.reference,
          errorName: error instanceof Error ? error.name : 'UnknownError',
        });
      }
    }
    return finalized.order;
  }

  private async recordFulfillmentBlockedPayment(input: {
    orderId: string;
    reference: string;
    amountInKobo: number;
    paidAt: Date;
    reason: string;
    method: PaymentMethod;
  }) {
    await this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "Order" WHERE "id" = ${input.orderId} FOR UPDATE`;
      const existing = await tx.payment.findUnique({
        where: { reference: input.reference },
      });
      if (existing && existing.orderId !== input.orderId) {
        throw new BadRequestException(
          'This payment reference belongs to another order',
        );
      }
      if (!existing) {
        await tx.payment.create({
          data: {
            orderId: input.orderId,
            method: input.method,
            status: PaymentStatus.PAID,
            amount: new Prisma.Decimal(input.amountInKobo).dividedBy(100),
            reference: input.reference,
            paidAt: input.paidAt,
          },
        });
      }
      const order = await tx.order.findUnique({ where: { id: input.orderId } });
      const note = `PAYMENT VERIFIED - FULFILLMENT BLOCKED: ${input.reason}`;
      await tx.order.update({
        where: { id: input.orderId },
        data: {
          paymentStatus: PaymentStatus.PAID,
          paidAt: input.paidAt,
          revenueSnapshot: new Prisma.Decimal(input.amountInKobo).dividedBy(
            100,
          ),
          adminNote: order?.adminNote ? `${order.adminNote}\n${note}` : note,
        },
      });
    });
  }

  private nairaToKobo(amount: Prisma.Decimal | number | string) {
    const kobo = new Prisma.Decimal(amount).times(100);
    if (
      !kobo.isInteger() ||
      kobo.isNegative() ||
      !Number.isSafeInteger(kobo.toNumber())
    ) {
      throw new BadRequestException('Order total cannot be converted to kobo');
    }
    return kobo.toNumber();
  }

  private getOrderResponse(tx: Prisma.TransactionClient, orderId: string) {
    return tx.order.findUnique({
      where: { id: orderId },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        paymentStatus: true,
        subtotal: true,
        deliveryFee: true,
        discount: true,
        totalAmount: true,
        deliveryState: true,
        trackingToken: true,
        trackingLink: true,
        paidAt: true,
        createdAt: true,
        customer: { select: { name: true, email: true, phone: true } },
        items: {
          select: {
            id: true,
            quantity: true,
            unitPriceSnapshot: true,
            totalPriceSnapshot: true,
            customization: true,
            variant: {
              select: {
                name: true,
                sku: true,
                product: { select: { name: true, category: true } },
              },
            },
          },
        },
      },
    });
  }
}
