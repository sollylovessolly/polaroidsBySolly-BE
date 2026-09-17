/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { SmsNotificationService } from './sms-notification.service';

describe('SmsNotificationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is safely disabled without credentials', async () => {
    const service = new SmsNotificationService({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.sendOwnerMessage('hello')).resolves.toBe(false);
  });

  it('sends a Termii SMS using configured credentials', async () => {
    const values: Record<string, string> = {
      TERMII_API_KEY: 'test-key',
      SMS_OWNER_PHONE: '2348012345678',
      TERMII_SENDER_ID: 'Polaroids',
      TERMII_BASE_URL: 'https://api.example.test/',
      TERMII_CHANNEL: 'generic',
    };
    const config = {
      get: jest.fn((key: string, fallback?: string) => values[key] ?? fallback),
    };
    const fetchMock = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ code: 'ok' }),
    } as unknown as Response);
    const service = new SmsNotificationService(
      config as unknown as ConfigService,
    );

    await expect(service.sendOwnerMessage('Paid order PBS-1')).resolves.toBe(
      true,
    );
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/api/sms/send',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('Paid order PBS-1'),
      }),
    );
  });

  it('rejects a provider-level failure returned with HTTP 200', async () => {
    const config = {
      get: jest.fn((key: string, fallback?: string) => {
        const values: Record<string, string> = {
          TERMII_API_KEY: 'test-key',
          SMS_OWNER_PHONE: '2348012345678',
          TERMII_SENDER_ID: 'Polaroids',
        };
        return values[key] ?? fallback;
      }),
    };
    jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({ code: 'failed' }),
    } as unknown as Response);
    const service = new SmsNotificationService(
      config as unknown as ConfigService,
    );

    await expect(service.sendOwnerMessage('hello')).rejects.toThrow(
      'SMS provider rejected the notification',
    );
  });
});
