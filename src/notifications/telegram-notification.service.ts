import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class TelegramNotificationService {
  private readonly logger = new Logger(TelegramNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOwnerMessage(message: string) {
    const token = this.config.get<string>('TELEGRAM_BOT_TOKEN');
    const chatId = this.config.get<string>('TELEGRAM_OWNER_CHAT_ID');
    if (!token || !chatId || token === 'replace_me' || chatId === 'replace_me')
      return false;

    const response = await fetch(
      `https://api.telegram.org/bot${token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          text: message,
          disable_web_page_preview: true,
        }),
      },
    );

    if (!response.ok) {
      this.logger.error({
        event: 'telegram_provider_failed',
        status: response.status,
      });
      throw new Error('Telegram provider rejected the notification');
    }

    return true;
  }
}
