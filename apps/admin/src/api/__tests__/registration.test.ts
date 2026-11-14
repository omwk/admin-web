import type { ApiRequestConfig } from '../client';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import { registerApi, verifyRegistrationApi } from '../core/registration';
import { envelope, respond } from './transport';

const calls = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: calls }));
const expired = vi.fn();
const refresh = vi.fn();
const token = vi.fn(() => 'active-session');
const notify = vi.fn();
const client = createApiClient(
  '/api/v1',
  {
    getAccessToken: token,
    onSessionExpired: expired,
    refreshAccessToken: refresh,
  },
  notify,
);
const input = {
  tenant: 'acme',
  account: 'alice',
  password: 'Password123',
  email: 'alice@example.test',
};
beforeEach(() => {
  vi.clearAllMocks();
  calls.post.mockImplementation(client.post.bind(client));
});
describe('anonymous registration transport', () => {
  it.each([201, 202])(
    'accepts %s with identical data and no authorization header',
    async (status) => {
      client.instance.defaults.adapter = (config) => {
        expect(config.url).toBe('/auth/register');
        expect(config.headers.Authorization).toBeUndefined();
        expect((config as ApiRequestConfig).authenticated).toBe(false);
        return respond(config, envelope({ accepted: true }), status);
      };
      await expect(registerApi(input)).resolves.toEqual({ accepted: true });
      expect(token).not.toHaveBeenCalled();
    },
  );
  it('does not expire or refresh a session when an unknown tenant is rejected', async () => {
    client.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, 20_101), 401);
    await expect(registerApi(input)).rejects.toMatchObject({ status: 401 });
    expect(expired).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    expect(notify).not.toHaveBeenCalled();
  });
  it('posts only the verification credential and handles an empty 204 response', async () => {
    client.instance.defaults.adapter = (config) => {
      expect(config.url).toBe('/auth/register/verify');
      expect(JSON.parse(config.data)).toEqual({ token: 'opaque' });
      expect(config.headers.Authorization).toBeUndefined();
      return respond(config, undefined, 204);
    };
    await expect(verifyRegistrationApi('opaque')).resolves.toBeUndefined();
  });
  it('retains stricter backend password policy errors', async () => {
    client.instance.defaults.adapter = (config) =>
      respond(
        config,
        { ...envelope(null, 10_001), message: '密码至少 12 个字符' },
        400,
      );
    await expect(registerApi(input)).rejects.toMatchObject({
      message: '密码至少 12 个字符',
    });
    expect(notify).not.toHaveBeenCalled();
  });
});
