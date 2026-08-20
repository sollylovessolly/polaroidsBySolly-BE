import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class WhatsAppNotificationService {
  private readonly logger = new Logger(WhatsAppNotificationService.name);
  constructor(private readonly config: ConfigService) {}

  async sendOwnerMessage(message: string) {
    const token = this.config.get<string>('WHATSAPP_ACCESS_TOKEN');
    const phoneNumberId = this.config.get<string>('WHATSAPP_PHONE_NUMBER_ID');
    const to = this.config.get<string>('WHATSAPP_OWNER_PHONE');
    if (!token || !phoneNumberId || !to || token === 'replace_me') return false;
    const version = this.config.get<string>('WHATSAPP_API_VERSION', 'v21.0');
    const response = await fetch(
      `https://graph.facebook.com/${version}/${phoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: message },
        }),
      },
    );
    if (!response.ok) {
      this.logger.error({
        event: 'whatsapp_provider_failed',
        status: response.status,
      });
      throw new Error('WhatsApp provider rejected the notification');
    }
    return true;
  }
}
