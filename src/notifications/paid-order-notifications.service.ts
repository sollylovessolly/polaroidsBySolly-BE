import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';

type PaidOrder = Prisma.OrderGetPayload<{
  include: {
    customer: true;
    items: { include: { variant: { include: { product: true } } } };
  };
}>;

@Injectable()
export class PaidOrderNotificationsService {
  private readonly logger = new Logger(PaidOrderNotificationsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly whatsapp: WhatsAppNotificationService,
    private readonly email: EmailService,
    private readonly config: ConfigService,
  ) {}

  async dispatch(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        customer: true,
        items: { include: { variant: { include: { product: true } } } },
      },
    });
    if (!order || order.paymentStatus !== 'PAID') return;
    await Promise.allSettled([
      this.notifyOwner(order),
      this.emailCustomer(order),
    ]);
  }

  private async notifyOwner(order: PaidOrder) {
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerNotifiedAt: null },
      data: { ownerNotifiedAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const items = order.items
        .map((item) => `${item.quantity} × ${item.variant.product.name}`)
        .join('\n');
      const sent = await this.whatsapp.sendOwnerMessage(
        `New paid order 🎉\n\nOrder: ${order.orderNumber}\nCustomer: ${order.customer.name}\nPhone: ${order.customer.phone}\nSource: ${order.source}\nTotal: ${this.money(order.totalAmount)}\nDelivery: ${order.deliveryState ?? 'Not specified'}\n\nItems:\n${items}`,
      );
      if (!sent) await this.release('ownerNotifiedAt', order.id, claimedAt);
    } catch (error) {
      await this.release('ownerNotifiedAt', order.id, claimedAt);
      this.logger.error({
        event: 'owner_notification_failed',
        orderId: order.id,
        orderNumber: order.orderNumber,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private async emailCustomer(order: PaidOrder) {
    if (!order.customer.email || !order.trackingToken) return;
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, customerEmailSentAt: null },
      data: { customerEmailSentAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const frontend = this.config
        .get<string>('FRONTEND_URL', 'http://localhost:3000')
        .replace(/\/$/, '');
      const items = order.items
        .map((item) => `${item.quantity} × ${item.variant.product.name}`)
        .join('\n');
      const sent = await this.email.send({
        to: order.customer.email,
        subject: `Your PolaroidsBySolly order is confirmed — ${order.orderNumber}`,
        text: `Hi ${order.customer.name},\n\nYour order has been confirmed.\n\nOrder: ${order.orderNumber}\nTotal paid: ${this.money(order.totalAmount)}\nDelivery: ${order.deliveryState ?? 'Not specified'}\n\nItems:\n${items}\n\nTrack your order:\n${frontend}/track-order/${order.trackingToken}\n\nThanks,\nPolaroidsBySolly`,
      });
      if (!sent) await this.release('customerEmailSentAt', order.id, claimedAt);
    } catch (error) {
      await this.release('customerEmailSentAt', order.id, claimedAt);
      this.logger.error({
        event: 'customer_email_failed',
        orderId: order.id,
        orderNumber: order.orderNumber,
        errorName: error instanceof Error ? error.name : 'UnknownError',
      });
    }
  }

  private release(
    field: 'ownerNotifiedAt' | 'customerEmailSentAt',
    id: string,
    claimedAt: Date,
  ) {
    return this.prisma.order.updateMany({
      where: { id, [field]: claimedAt },
      data: { [field]: null },
    });
  }

  private money(value: unknown) {
    return `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
