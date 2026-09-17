import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class DiscordNotificationService {
  private readonly logger = new Logger(DiscordNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOwnerMessage(message: string) {
    const webhookUrl = this.config.get<string>('DISCORD_WEBHOOK_URL')?.trim();
    if (!webhookUrl || webhookUrl === 'replace_me') return false;

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'PolaroidsBySolly Orders',
        content: message.slice(0, 2000),
        allowed_mentions: { parse: [] },
      }),
    });

    if (!response.ok) {
      this.logger.error({
        event: 'discord_provider_failed',
        status: response.status,
      });
      throw new Error('Discord rejected the notification');
    }

    return true;
  }
}
