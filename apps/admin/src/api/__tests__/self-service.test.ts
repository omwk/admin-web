import type { ApiRequestConfig } from '../client';

import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import {
  changeMyPasswordApi,
  getMyProfileApi,
  getMySessionsApi,
  logoutAllApi,
  updateMyProfileApi,
} from '../core/self-service';
import { envelope, respond } from './transport';

const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn(), put: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: calls }));

describe('personal account contracts', () => {
  it('uses server pagination and a separate logout-all endpoint', async () => {
    await getMySessionsApi(2, 20);
    expect(calls.get).toHaveBeenCalledWith('/auth/sessions', {
      silent: true,
      params: { page: 2, page_size: 20, sort: '-created_at' },
    });
    await logoutAllApi();
    expect(calls.post).toHaveBeenCalledWith('/auth/logout-all', undefined, {
      silent: true,
    });
  });
  it('reads only the authenticated identity endpoint and retains profile fields', async () => {
    const user = { id: 3, username: 'reader', email: 'reader@example.test' };
    calls.get.mockResolvedValueOnce({ user, tenant_code: 'acme' });
    await expect(getMyProfileApi()).resolves.toMatchObject({
      ...user,
      tenant_code: 'acme',
    });
    expect(calls.get).toHaveBeenCalledWith('/auth/me', { silent: true });
  });

  it('updates editable fields without submitting authority fields', async () => {
    const input = { nickname: '新昵称', email: 'new@example.test', avatar: '' };
    await updateMyProfileApi(input);
    expect(calls.put).toHaveBeenCalledWith('/auth/profile', input, {
      preserveBusinessMessage: true,
      silent: true,
    });
  });

  it('submits camelCase passwords and marks credential rejection as a form error', async () => {
    const input = { oldPassword: 'OldPass123', newPassword: 'NewPass123' };
    await changeMyPasswordApi(input);
    expect(calls.put).toHaveBeenCalledWith('/auth/password', input, {
      credentialCheck: true,
      silent: true,
    });
  });

  it('does not expire or refresh a valid session when the old password is wrong', async () => {
    const expired = vi.fn();
    const refresh = vi.fn();
    const client = createApiClient(
      '/api/v1',
      {
        getAccessToken: () => 'current-access',
        onSessionExpired: expired,
        refreshAccessToken: refresh,
      },
      vi.fn(),
    );
    client.instance.defaults.adapter = (config) =>
      respond(
        config,
        { ...envelope(null, 20_101), message: '旧密码不正确' },
        401,
      );
    const options: ApiRequestConfig = { credentialCheck: true, silent: true };
    await expect(
      client.put('/auth/password', {}, options),
    ).rejects.toMatchObject({ businessMessage: '旧密码不正确' });
    expect(expired).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
  });
});
