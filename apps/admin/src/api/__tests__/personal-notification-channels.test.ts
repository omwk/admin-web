import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deletePersonalNotificationChannelApi,
  getPersonalNotificationChannelsApi,
  savePersonalNotificationChannelApi,
  testPersonalNotificationChannelApi,
} from '../core/personal-notification-channels';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  put: vi.fn(),
  post: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
beforeEach(() => vi.resetAllMocks());

describe('personal notification channel contracts', () => {
  it('uses authenticated self-service routes and never sends an owner ID', async () => {
    const endpoint = new URL(crypto.randomUUID(), 'https://example.test').href;
    const masked = { channels: [{ channel: 'bark', endpoint_masked: '****' }] };
    client.get.mockResolvedValue(masked);
    await expect(getPersonalNotificationChannelsApi()).resolves.toEqual(masked);
    await savePersonalNotificationChannelApi('bark', endpoint);
    await testPersonalNotificationChannelApi('bark');
    await deletePersonalNotificationChannelApi('bark');
    expect(client.get).toHaveBeenCalledWith('/auth/notification-channels', {
      silent: true,
    });
    expect(client.put).toHaveBeenCalledWith(
      '/auth/notification-channels/bark',
      { endpoint },
      { silent: true },
    );
    expect(client.post).toHaveBeenCalledWith(
      '/auth/notification-channels/bark/test',
      undefined,
      { silent: true },
    );
    expect(client.delete).toHaveBeenCalledWith(
      '/auth/notification-channels/bark',
      { silent: true },
    );
  });
});
