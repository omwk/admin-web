import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import { ApiError } from '../errors';
import { envelope, respond } from './transport';

function setup() {
  let token: null | string = 'old-access';
  const auth = {
    getAccessToken: () => token,
    onSessionExpired: vi.fn(),
    refreshAccessToken: vi.fn(async () => {
      token = 'new-access';
      return token;
    }),
  };
  const notify = vi.fn();
  const client = createApiClient('/api/v1', auth, notify);
  return { auth, client, notify };
}

describe('identity request client', () => {
  it('unwraps the envelope and sends Bearer and Chinese headers', async () => {
    const { client } = setup();
    client.instance.defaults.adapter = async (config) => {
      expect(config.baseURL).toBe('/api/v1');
      expect(config.headers.Authorization).toBe('Bearer old-access');
      expect(config.headers['Accept-Language']).toBe('zh-CN');
      return respond(config, envelope({ id: 1 }));
    };
    await expect(client.get('/auth/me')).resolves.toEqual({ id: 1 });
  });

  it('rejects nonzero business codes even with HTTP 200, retaining trace ID', async () => {
    const { client, notify } = setup();
    client.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, 20_107));
    const error = await client
      .get('/admin/users')
      .catch((error: unknown) => error);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({
      code: 20_107,
      status: 200,
      traceId: 'trace-test',
    });
    expect(notify).toHaveBeenCalledWith('没有权限执行此操作');
    expect(String(error)).not.toContain('BACKEND_PRIVATE_MESSAGE');
  });

  it.each([
    [401, 20_101, '登录已失效，请重新登录'],
    [403, 20_107, '没有权限执行此操作'],
    [409, 10_004, '请求处理中，请稍后重试'],
    [429, 10_005, '请求过于频繁，请稍后重试'],
    [409, 99_999, '数据冲突，请刷新后重试'],
  ])('maps HTTP %i / code %i locally', async (status, code, text) => {
    const { client, notify } = setup();
    client.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, code), status);
    await expect(client.get('/admin/users')).rejects.toThrow(text);
    expect(notify).toHaveBeenCalledWith(text);
    expect(JSON.stringify(notify.mock.calls)).not.toContain(
      'BACKEND_PRIVATE_MESSAGE',
    );
  });

  it('refreshes natural expiry and replays the original request once', async () => {
    const { auth, client, notify } = setup();
    let calls = 0;
    client.instance.defaults.adapter = (config) => {
      calls++;
      expect(config.params).toEqual({ page: 2 });
      return config.headers.Authorization === 'Bearer old-access'
        ? respond(config, envelope(null, 20_102), 401)
        : respond(config, envelope({ list: [1] }));
    };
    await expect(
      client.get('/admin/users', { params: { page: 2 } }),
    ).resolves.toEqual({ list: [1] });
    expect(calls).toBe(2);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([20_101, 20_103])(
    'expires revoked sessions (%i) without refreshing',
    async (code) => {
      const { auth, client } = setup();
      client.instance.defaults.adapter = (config) =>
        respond(config, envelope(null, code), 401);
      await expect(client.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
      expect(auth.onSessionExpired).toHaveBeenCalledTimes(1);
      expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    },
  );

  it('never refreshes a failed login and omits Authorization', async () => {
    const { auth, client, notify } = setup();
    client.instance.defaults.adapter = (config) => {
      expect(config.headers.Authorization).toBeUndefined();
      return respond(config, envelope(null, 20_101), 401);
    };
    await expect(
      client.post('/auth/login', {}, { authenticated: false } as never),
    ).rejects.toBeInstanceOf(ApiError);
    expect(auth.refreshAccessToken).not.toHaveBeenCalled();
    expect(auth.onSessionExpired).not.toHaveBeenCalled();
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('ends a failed replay without another refresh or duplicate notifications', async () => {
    const { auth, client, notify } = setup();
    client.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, 20_102), 401);
    await expect(client.get('/auth/me')).rejects.toBeInstanceOf(ApiError);
    expect(auth.refreshAccessToken).toHaveBeenCalledTimes(1);
    expect(auth.onSessionExpired).toHaveBeenCalledTimes(1);
    expect(notify).toHaveBeenCalledTimes(1);
  });

  it('accepts logout HTTP 204 and suppresses 20109 feedback', async () => {
    const { client, notify } = setup();
    client.instance.defaults.adapter = (config) => respond(config, '', 204);
    await expect(client.post('/auth/logout')).resolves.toBeUndefined();
    client.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, 20_109), 409);
    await expect(
      client.post('/auth/refresh', {}, { authenticated: false } as never),
    ).rejects.toMatchObject({ code: 20_109 });
    expect(notify).not.toHaveBeenCalled();
  });

  it.each([401, 409])(
    'does not expire or notify when coordinated refresh remains busy with HTTP %i / 20109',
    async (status) => {
      const { auth, client, notify } = setup();
      auth.refreshAccessToken.mockRejectedValue(
        new ApiError({ code: 20_109, status }),
      );
      client.instance.defaults.adapter = (config) =>
        respond(config, envelope(null, 20_102), 401);
      await expect(client.get('/auth/me')).rejects.toMatchObject({
        code: 20_109,
      });
      expect(auth.onSessionExpired).not.toHaveBeenCalled();
      expect(notify).not.toHaveBeenCalled();
    },
  );
});
