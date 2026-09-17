import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly config: ConfigService) {}

  async send(input: { to: string; subject: string; text: string }) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    const from = this.config.get<string>('EMAIL_FROM');
    if (!apiKey || !from || apiKey === 'replace_me') return false;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'User-Agent': 'PolaroidsBySolly/1.0',
      },
      body: JSON.stringify({ from, ...input }),
    });
    if (!response.ok) {
      this.logger.error({
        event: 'email_provider_failed',
        status: response.status,
      });
      throw new Error('Email provider rejected the notification');
    }
    return true;
  }
}
