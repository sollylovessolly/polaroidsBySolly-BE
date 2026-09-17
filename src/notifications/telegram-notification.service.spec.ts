/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import { ConfigService } from '@nestjs/config';
import { TelegramNotificationService } from './telegram-notification.service';

describe('TelegramNotificationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is safely disabled without credentials', async () => {
    const service = new TelegramNotificationService({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.sendOwnerMessage('hello')).resolves.toBe(false);
  });

  it('sends the owner message through the Bot API', async () => {
    const config = {
      get: jest.fn((key: string) =>
        key === 'TELEGRAM_BOT_TOKEN' ? '123:token' : '456',
      ),
    };
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    const service = new TelegramNotificationService(
      config as unknown as ConfigService,
    );

    await expect(service.sendOwnerMessage('paid order')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.telegram.org/bot123:token/sendMessage',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('paid order'),
      }),
    );
  });
});
