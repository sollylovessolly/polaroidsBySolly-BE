import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

type TermiiSendResponse = {
  code?: string;
  message?: string;
};

@Injectable()
export class SmsNotificationService {
  private readonly logger = new Logger(SmsNotificationService.name);

  constructor(private readonly config: ConfigService) {}

  async sendOwnerMessage(message: string) {
    const apiKey = this.config.get<string>('TERMII_API_KEY');
    const to = this.config.get<string>('SMS_OWNER_PHONE');
    const from = this.config.get<string>('TERMII_SENDER_ID');
    if (
      !apiKey ||
      !to ||
      !from ||
      apiKey === 'replace_me' ||
      to === 'replace_me' ||
      from === 'replace_me'
    )
      return false;

    const baseUrl = this.config
      .get<string>('TERMII_BASE_URL', 'https://api.ng.termii.com')
      .replace(/\/$/, '');
    const channel = this.config.get<string>('TERMII_CHANNEL', 'generic');
    const response = await fetch(`${baseUrl}/api/sms/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: apiKey,
        to,
        from,
        sms: message,
        type: 'plain',
        channel,
      }),
    });
    const body = (await response
      .json()
      .catch(() => ({}))) as TermiiSendResponse;

    if (!response.ok || body.code !== 'ok') {
      this.logger.error({
        event: 'sms_provider_failed',
        status: response.status,
        providerCode: body.code ?? 'unknown',
      });
      throw new Error('SMS provider rejected the notification');
    }

    return true;
  }
}
