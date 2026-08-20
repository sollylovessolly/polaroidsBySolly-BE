import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ShipbubbleService } from './shipbubble.service';
import { ShippingRateDto } from './dto/shipping-rate.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly provider: ShipbubbleService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async rates(dto: ShippingRateDto) {
    if (!this.provider.isConfigured())
      throw new BadRequestException('Delivery provider is not configured');
    const variants = await this.prisma.productVariant.findMany({
      where: {
        sku: { in: dto.items.map((item) => item.variantSku) },
        isActive: true,
        product: { isActive: true },
      },
      include: { product: true },
    });
    if (
      variants.length !== new Set(dto.items.map((item) => item.variantSku)).size
    )
      throw new BadRequestException(
        'One or more product variants are unavailable',
      );
    const addressCode = await this.provider.validateAddress({
      name: dto.name,
      email: dto.email,
      phone: dto.phone,
      address: `${dto.address}, ${dto.state}, Nigeria`,
    });
    const unitWeight =
      this.config?.get<string>('SHIPBUBBLE_DEFAULT_UNIT_WEIGHT_KG', '0.1') ??
      '0.1';
    return this.provider.fetchRates({
      receiverAddressCode: addressCode,
      pickupDate:
        dto.pickupDate ??
        new Date(Date.now() + 86_400_000).toISOString().slice(0, 10),
      packageItems: dto.items.map((item) => {
        const variant = variants.find(
          (value) => value.sku === item.variantSku,
        )!;
        return {
          name: variant.product.name,
          description: variant.name,
          unit_weight: unitWeight,
          unit_amount: variant.sellingPrice.toString(),
          quantity: String(item.quantity),
        };
      }),
    });
  }

  async attempt(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order)
      throw new NotFoundException(`Order with ID "${orderId}" was not found`);
    if (order.paymentStatus !== PaymentStatus.PAID)
      return { created: false, reason: 'ORDER_UNPAID' };
    if (order.shipmentReference)
      return {
        created: false,
        reason: 'ALREADY_CREATED',
        reference: order.shipmentReference,
      };
    if (
      !order.shipmentRequestToken ||
      !order.shipmentServiceCode ||
      !order.shipmentCourierId
    )
      return { created: false, reason: 'NO_SHIPMENT_SELECTION' };
    if (!this.provider.isConfigured())
      return { created: false, reason: 'PROVIDER_DISABLED' };

    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: {
        id: orderId,
        shipmentReference: null,
        shipmentAttemptedAt: null,
      },
      data: {
        shipmentAttemptedAt: claimedAt,
        shipmentStatus: 'CREATING',
        shipmentError: null,
      },
    });
    if (!claim.count) return { created: false, reason: 'ALREADY_ATTEMPTED' };
    try {
      const shipment = await this.provider.createShipment({
        requestToken: order.shipmentRequestToken,
        serviceCode: order.shipmentServiceCode,
        courierId: order.shipmentCourierId,
      });
      const deliveryCost = new Prisma.Decimal(shipment.shippingFee);
      const grossProfit = new Prisma.Decimal(order.revenueSnapshot)
        .minus(order.materialCostSnapshot)
        .minus(order.packagingCostSnapshot)
        .minus(order.outsourceCostSnapshot)
        .minus(deliveryCost);
      const updated = await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shipmentReference: shipment.orderId,
          shipmentStatus: shipment.status,
          shipmentError: null,
          shipmentCreatedAt: new Date(),
          trackingLink: shipment.trackingUrl,
          actualDeliveryCost: deliveryCost,
          deliveryCostSnapshot: deliveryCost,
          grossProfitSnapshot: grossProfit,
        },
      });
      this.logger.log({
        event: 'shipment_created',
        orderId,
        shipmentReference: shipment.orderId,
      });
      return { created: true, order: updated };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown shipment error';
      await this.prisma.order.update({
        where: { id: orderId },
        data: {
          shipmentStatus: 'FAILED',
          shipmentError: message.slice(0, 500),
        },
      });
      this.logger.error({
        event: 'shipment_creation_failed',
        orderId,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
      return { created: false, reason: 'PROVIDER_FAILED' };
    }
  }

  async retry(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });
    if (!order)
      throw new NotFoundException(`Order with ID "${orderId}" was not found`);
    if (order.paymentStatus !== PaymentStatus.PAID)
      throw new BadRequestException(
        'Shipment can only be created for a paid order',
      );
    if (order.shipmentReference)
      throw new BadRequestException('Shipment already exists for this order');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { shipmentAttemptedAt: null, shipmentError: null },
    });
    this.logger.log({ event: 'shipment_retry_requested', orderId });
    return this.attempt(orderId);
  }
}
