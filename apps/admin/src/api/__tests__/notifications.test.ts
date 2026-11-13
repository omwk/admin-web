import type { ApiRequestConfig } from '../client';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import {
  deleteNotificationProviderApi,
  getNotificationDeliveriesApi,
  getNotificationPreferencesApi,
  getNotificationProvidersApi,
  getNotificationsApi,
  readAllNotificationsApi,
  readNotificationApi,
  retryNotificationDeliveryApi,
  saveNotificationPreferencesApi,
  saveNotificationProviderApi,
  saveNotificationTemplateApi,
  testNotificationProviderApi,
} from '../core/notifications';
import { notificationError, safeProviderConfig } from '../notification-safety';
import { envelope, respond } from './transport';

const client = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: client }));
beforeEach(() => vi.resetAllMocks());

describe('notification API contracts', () => {
  it('uses current-user inbox filters and read routes without a separate read grant', async () => {
    await getNotificationsApi({
      page: 2,
      page_size: 20,
      unread: true,
      template: 'notification.default',
    });
    await readNotificationApi(17);
    await readAllNotificationsApi();
    expect(client.get).toHaveBeenCalledWith('/admin/notifications', {
      silent: true,
      params: {
        page: 2,
        page_size: 20,
        unread: true,
        template: 'notification.default',
      },
    });
    expect(client.put).toHaveBeenCalledWith(
      '/admin/notifications/17/read',
      undefined,
      { silent: true },
    );
    expect(client.post).toHaveBeenCalledWith(
      '/admin/notifications/read-all',
      undefined,
      { silent: true },
    );
  });
  it('submits only provided preference pairs and preserves false', async () => {
    const changes = [
      {
        template: 'notification.default',
        channel: 'email' as const,
        enabled: false,
      },
    ];
    await getNotificationPreferencesApi();
    await saveNotificationPreferencesApi(changes);
    expect(client.put).toHaveBeenCalledWith(
      '/admin/notifications/preferences',
      { preferences: changes },
      { silent: true },
    );
  });
  it('projects saved configuration into flags and never returns raw saved credentials', async () => {
    const secret = crypto.randomUUID();
    client.get.mockResolvedValue({
      list: [
        {
          id: 1,
          config: {
            api_key: secret,
            api_key_configured: true,
            region: 'cn-test',
            unexpected: secret,
          },
        },
      ],
      total: 1,
    });
    client.post.mockResolvedValue({
      id: 2,
      config: { password: secret, smtp_addr_configured: true },
    });
    const page = await getNotificationProvidersApi(2, 10);
    const saved = await saveNotificationProviderApi({
      name: '测试',
      channel: 'email',
      kind: 'smtp',
      enabled: true,
      priority: 0,
      config: {},
    });
    expect(JSON.stringify([page, saved])).not.toContain(secret);
    expect(page.list[0]?.config).toEqual({
      api_key_configured: true,
      region: 'cn-test',
    });
    expect(saved.config).toEqual({
      password_configured: true,
      smtp_addr_configured: true,
    });
  });
  it('uses the current-account test contract and documented retry endpoint', async () => {
    await testNotificationProviderApi(4);
    await retryNotificationDeliveryApi(8);
    await getNotificationDeliveriesApi(3, 10);
    await deleteNotificationProviderApi(4);
    expect(client.post).toHaveBeenCalledWith(
      '/admin/notifications/providers/4/test',
      undefined,
      { silent: true },
    );
    expect(client.post).toHaveBeenCalledWith(
      '/admin/notifications/deliveries/8/retry',
      undefined,
      { silent: true },
    );
    expect(client.get).toHaveBeenCalledWith('/admin/notifications/deliveries', {
      silent: true,
      params: { page: 3, page_size: 10 },
    });
    expect(client.delete).toHaveBeenCalledWith(
      '/admin/notifications/providers/4',
      { silent: true },
    );
  });
  it('escapes a template code in its path', async () => {
    const input = {
      subject: '主题',
      body: '{{.Name}}',
      locale: 'zh-CN',
      format: 'text' as const,
      enabled: true,
    };
    await saveNotificationTemplateApi('type/with space', input);
    expect(client.put).toHaveBeenCalledWith(
      '/admin/notifications/templates/type%2Fwith%20space',
      input,
      { silent: true },
    );
  });
});
describe('notification message safety', () => {
  it('preserves backend failure copy for notifications while generic errors remain localized', async () => {
    const api = createApiClient(
      '/api/v1',
      {
        getAccessToken: () => null,
        onSessionExpired: vi.fn(),
        refreshAccessToken: vi.fn(),
      },
      vi.fn(),
      false,
    );
    api.instance.defaults.adapter = (config) =>
      respond(
        config,
        {
          ...envelope(null, 10_002),
          message: '测试发送失败：provider_delivery_failed',
        },
        503,
      );
    const options: ApiRequestConfig = { silent: true };
    const failure: unknown = await api
      .post('/admin/notifications/providers/1/test', undefined, options)
      .catch((error: unknown) => error);
    expect((failure as Error).message).toBe('服务暂不可用，请稍后重试');
    expect(notificationError(failure)).toBe(
      '测试发送失败：provider_delivery_failed',
    );
  });
  it('redacts entered configuration from validation errors', () => {
    const secret = crypto.randomUUID();
    expect(notificationError(new Error(`配置无效：${secret}`), [secret])).toBe(
      '配置无效：已配置',
    );
    expect(
      safeProviderConfig({
        endpoint: secret,
        tls_mode: 'tls',
        endpoint_configured: true,
      }),
    ).toEqual({ endpoint_configured: true, tls_mode: 'tls' });
  });
});
