import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PaidOrderNotificationsService } from './paid-order-notifications.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';
import { TelegramNotificationService } from './telegram-notification.service';
import { SmsNotificationService } from './sms-notification.service';
import { DiscordNotificationService } from './discord-notification.service';

@Module({
  providers: [
    EmailService,
    WhatsAppNotificationService,
    TelegramNotificationService,
    SmsNotificationService,
    DiscordNotificationService,
    PaidOrderNotificationsService,
  ],
  exports: [PaidOrderNotificationsService],
})
export class NotificationsModule {}
