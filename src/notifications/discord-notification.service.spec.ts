import { ConfigService } from '@nestjs/config';
import { DiscordNotificationService } from './discord-notification.service';

describe('DiscordNotificationService', () => {
  afterEach(() => jest.restoreAllMocks());

  it('is safely disabled without a webhook URL', async () => {
    const service = new DiscordNotificationService({
      get: jest.fn(),
    } as unknown as ConfigService);

    await expect(service.sendOwnerMessage('hello')).resolves.toBe(false);
  });

  it('posts the owner message without allowing mentions', async () => {
    const webhookUrl = 'https://discord.com/api/webhooks/123/token';
    const fetchMock = jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true } as Response);
    const service = new DiscordNotificationService({
      get: jest.fn().mockReturnValue(webhookUrl),
    } as unknown as ConfigService);

    await expect(service.sendOwnerMessage('paid order')).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      webhookUrl,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          username: 'PolaroidsBySolly Orders',
          content: 'paid order',
          allowed_mentions: { parse: [] },
        }),
      }),
    );
  });

  it('throws when Discord rejects the notification', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: false, status: 429 } as Response);
    const service = new DiscordNotificationService({
      get: jest.fn().mockReturnValue('https://discord.com/api/webhooks/1/x'),
    } as unknown as ConfigService);

    await expect(service.sendOwnerMessage('paid order')).rejects.toThrow(
      'Discord rejected the notification',
    );
  });
});
