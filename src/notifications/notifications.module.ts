import { Module } from '@nestjs/common';
import { EmailService } from './email.service';
import { PaidOrderNotificationsService } from './paid-order-notifications.service';
import { WhatsAppNotificationService } from './whatsapp-notification.service';

@Module({
  providers: [
    EmailService,
    WhatsAppNotificationService,
    PaidOrderNotificationsService,
  ],
  exports: [PaidOrderNotificationsService],
})
export class NotificationsModule {}
