import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'node:crypto';

type PaystackEnvelope<T> = {
  status: boolean;
  message: string;
  data: T;
};

export type PaystackTransaction = {
  status: string;
  reference: string;
  amount: number;
  currency: string;
  paid_at?: string | null;
  metadata?: { orderId?: string } | null;
};

@Injectable()
export class PaystackService {
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.baseUrl = this.config.get(
      'PAYSTACK_BASE_URL',
      'https://api.paystack.co',
    );
  }

  async initializeTransaction(input: {
    email: string;
    amount: number;
    metadata: Record<string, string>;
  }) {
    const response = await this.request<{
      authorization_url: string;
      access_code: string;
      reference: string;
    }>('/transaction/initialize', {
      method: 'POST',
      body: JSON.stringify(input),
    });

    return response.data;
  }

  async verifyTransaction(reference: string) {
    const response = await this.request<PaystackTransaction>(
      `/transaction/verify/${encodeURIComponent(reference)}`,
      { method: 'GET' },
    );
    return response.data;
  }

  verifyWebhookSignature(rawBody: Buffer, signature?: string) {
    if (!signature) return false;

    const expected = createHmac('sha512', this.getSecretKey())
      .update(rawBody)
      .digest('hex');
    const received = Buffer.from(signature, 'utf8');
    const expectedBuffer = Buffer.from(expected, 'utf8');

    return (
      received.length === expectedBuffer.length &&
      timingSafeEqual(received, expectedBuffer)
    );
  }

  private async request<T>(path: string, init: RequestInit) {
    let response: Response;

    try {
      response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${this.getSecretKey()}`,
          'Content-Type': 'application/json',
          ...init.headers,
        },
      });
    } catch {
      throw new ServiceUnavailableException(
        'Paystack is currently unavailable',
      );
    }

    const payload = (await response.json()) as PaystackEnvelope<T>;
    if (!response.ok || !payload.status) {
      throw new BadGatewayException(
        payload.message || 'Paystack request failed',
      );
    }
    return payload;
  }

  private getSecretKey() {
    const secret = this.config.get<string>('PAYSTACK_SECRET_KEY');
    if (!secret) {
      throw new ServiceUnavailableException('Paystack is not configured');
    }
    return secret;
  }
}
