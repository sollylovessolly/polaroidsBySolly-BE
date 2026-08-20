import { Injectable, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'node:crypto';

import { PaymentStatus, Prisma } from '../generated/prisma/client';
import { PhoneNumberService } from '../customers/phone-number.service';
import { PrismaService } from '../prisma/prisma.service';

const trackingInclude = {
  items: { include: { variant: { include: { product: true } } } },
  statusHistory: { orderBy: { changedAt: 'asc' as const } },
} satisfies Prisma.OrderInclude;

@Injectable()
export class TrackingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly phoneNumbers: PhoneNumberService,
  ) {}

  async findByPhone(phone: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        paymentStatus: PaymentStatus.PAID,
        customer: {
          phone: { in: this.phoneNumbers.lookupCandidates(phone) },
        },
      },
      include: trackingInclude,
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(
      orders.map(async (order) => {
        const trackingToken =
          order.trackingToken ?? (await this.assignToken(order.id));
        return this.serialize(order, trackingToken, false);
      }),
    );
  }

  async findOne(token: string) {
    const order = await this.prisma.order.findFirst({
      where: { trackingToken: token, paymentStatus: PaymentStatus.PAID },
      include: trackingInclude,
    });
    if (!order) {
      throw new NotFoundException('Tracked order was not found');
    }
    return this.serialize(order, token, true);
  }

  private async assignToken(orderId: string) {
    const trackingToken = randomBytes(32).toString('base64url');
    await this.prisma.order.update({
      where: { id: orderId },
      data: { trackingToken },
    });
    return trackingToken;
  }

  private serialize(
    order: Prisma.OrderGetPayload<{ include: typeof trackingInclude }>,
    trackingToken: string,
    includeTimeline: boolean,
  ) {
    return {
      trackingToken,
      orderNumber: order.orderNumber,
      status: order.status,
      paymentStatus: order.paymentStatus,
      createdAt: order.createdAt,
      paidAt: order.paidAt,
      totalAmount: order.totalAmount,
      deliveryState: order.deliveryState,
      maskedDeliveryAddress: this.maskAddress(
        order.deliveryAddress,
        order.deliveryState,
      ),
      trackingLink: order.trackingLink,
      shipmentStatus: order.shipmentStatus,
      items: order.items.map((item) => ({
        name: item.variant.name,
        productName: item.variant.product.name,
        quantity: item.quantity,
      })),
      ...(includeTimeline
        ? {
            timeline: order.statusHistory.map((entry) => ({
              status: entry.status,
              changedAt: entry.changedAt,
            })),
          }
        : {}),
    };
  }

  private maskAddress(address: string | null, state: string | null) {
    if (!address) return state;
    const parts = address
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);
    const safeParts = parts.length > 2 ? parts.slice(-2) : parts.slice(-1);
    if (
      state &&
      !safeParts.some((part) => part.toLowerCase() === state.toLowerCase())
    ) {
      safeParts.push(state);
    }
    return safeParts.join(', ');
  }
}
