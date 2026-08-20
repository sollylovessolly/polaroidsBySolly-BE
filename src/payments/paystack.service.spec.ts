/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';

import { PaystackService } from './paystack.service';

describe('PaystackService', () => {
  const secret = 'sk_test_unit_test_only';
  const config = {
    get: jest.fn((key: string, fallback?: string) => {
      if (key === 'PAYSTACK_SECRET_KEY') return secret;
      if (key === 'PAYSTACK_BASE_URL') return fallback;
      return undefined;
    }),
  } as unknown as ConfigService;
  const service = new PaystackService(config);

  afterEach(() => jest.restoreAllMocks());

  it('uses the environment key and Paystack initialization contract', async () => {
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          status: true,
          message: 'Authorization URL created',
          data: {
            authorization_url: 'https://checkout.paystack.com/code',
            access_code: 'code',
            reference: 'reference',
          },
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );

    await service.initializeTransaction({
      email: 'jane@example.com',
      amount: 1_080_000,
      metadata: { orderId: 'order-1' },
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.paystack.co/transaction/initialize',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: `Bearer ${secret}`,
        }),
      }),
    );
  });

  it('verifies webhook signatures over the exact raw bytes', () => {
    const rawBody = Buffer.from('{"event":"charge.success"}');
    const signature = createHmac('sha512', secret)
      .update(rawBody)
      .digest('hex');

    expect(service.verifyWebhookSignature(rawBody, signature)).toBe(true);
    expect(service.verifyWebhookSignature(rawBody, 'invalid')).toBe(false);
  });
});
