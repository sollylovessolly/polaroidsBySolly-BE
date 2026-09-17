import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { SmsNotificationService } from './sms-notification.service';
import { DiscordNotificationService } from './discord-notification.service';

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
    private readonly telegram: TelegramNotificationService,
    private readonly sms: SmsNotificationService,
    private readonly discord: DiscordNotificationService,
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
      this.notifyOwnerByWhatsApp(order),
      this.notifyOwnerByTelegram(order),
      this.notifyOwnerBySms(order),
      this.notifyOwnerByDiscord(order),
      this.notifyOwnerByEmail(order),
      this.emailCustomer(order),
    ]);
  }

  private async notifyOwnerByWhatsApp(order: PaidOrder) {
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerNotifiedAt: null },
      data: { ownerNotifiedAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const sent = await this.whatsapp.sendOwnerMessage(
        this.ownerMessage(order),
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

  private async notifyOwnerByTelegram(order: PaidOrder) {
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerTelegramSentAt: null },
      data: { ownerTelegramSentAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const sent = await this.telegram.sendOwnerMessage(
        this.ownerMessage(order),
      );
      if (!sent) await this.release('ownerTelegramSentAt', order.id, claimedAt);
    } catch (error) {
      await this.release('ownerTelegramSentAt', order.id, claimedAt);
      this.logOwnerFailure('owner_telegram_notification_failed', order, error);
    }
  }

  private async notifyOwnerByEmail(order: PaidOrder) {
    const to =
      this.config.get<string>('OWNER_NOTIFICATION_EMAIL')?.trim() ||
      this.config.get<string>('ADMIN_EMAIL')?.trim();
    if (!to) return;
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerEmailSentAt: null },
      data: { ownerEmailSentAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const sent = await this.email.send({
        to,
        subject: `New paid order — ${order.orderNumber}`,
        text: this.ownerMessage(order),
      });
      if (!sent) await this.release('ownerEmailSentAt', order.id, claimedAt);
    } catch (error) {
      await this.release('ownerEmailSentAt', order.id, claimedAt);
      this.logOwnerFailure('owner_email_notification_failed', order, error);
    }
  }

  private async notifyOwnerBySms(order: PaidOrder) {
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerSmsSentAt: null },
      data: { ownerSmsSentAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const sent = await this.sms.sendOwnerMessage(this.ownerSmsMessage(order));
      if (!sent) await this.release('ownerSmsSentAt', order.id, claimedAt);
    } catch (error) {
      await this.release('ownerSmsSentAt', order.id, claimedAt);
      this.logOwnerFailure('owner_sms_notification_failed', order, error);
    }
  }

  private async notifyOwnerByDiscord(order: PaidOrder) {
    const claimedAt = new Date();
    const claim = await this.prisma.order.updateMany({
      where: { id: order.id, ownerDiscordSentAt: null },
      data: { ownerDiscordSentAt: claimedAt },
    });
    if (!claim.count) return;
    try {
      const sent = await this.discord.sendOwnerMessage(
        this.ownerMessage(order),
      );
      if (!sent) await this.release('ownerDiscordSentAt', order.id, claimedAt);
    } catch (error) {
      await this.release('ownerDiscordSentAt', order.id, claimedAt);
      this.logOwnerFailure('owner_discord_notification_failed', order, error);
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
    field:
      | 'ownerNotifiedAt'
      | 'ownerEmailSentAt'
      | 'ownerTelegramSentAt'
      | 'ownerSmsSentAt'
      | 'ownerDiscordSentAt'
      | 'customerEmailSentAt',
    id: string,
    claimedAt: Date,
  ) {
    return this.prisma.order.updateMany({
      where: { id, [field]: claimedAt },
      data: { [field]: null },
    });
  }

  private ownerMessage(order: PaidOrder) {
    const items = order.items
      .map((item) => `${item.quantity} × ${item.variant.product.name}`)
      .join('\n');
    return `New paid order 🎉\n\nOrder: ${order.orderNumber}\nCustomer: ${order.customer.name}\nPhone: ${order.customer.phone}\nSource: ${order.source}\nTotal: ${this.money(order.totalAmount)}\nDelivery: ${order.deliveryState ?? 'Not specified'}\n\nItems:\n${items}`;
  }

  private ownerSmsMessage(order: PaidOrder) {
    const items = order.items
      .map((item) => `${item.quantity}x ${item.variant.product.name}`)
      .join(', ');
    const message = `Paid order ${order.orderNumber}. ${order.customer.name}, ${order.customer.phone}. Total NGN ${Number(order.totalAmount).toFixed(0)}. Delivery: ${order.deliveryState ?? 'Not specified'}. Items: ${items}`;
    return message.slice(0, 300);
  }

  private logOwnerFailure(event: string, order: PaidOrder, error: unknown) {
    this.logger.error({
      event,
      orderId: order.id,
      orderNumber: order.orderNumber,
      errorName: error instanceof Error ? error.name : 'UnknownError',
    });
  }

  private money(value: unknown) {
    return `₦${Number(value).toLocaleString('en-NG', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  }
}
