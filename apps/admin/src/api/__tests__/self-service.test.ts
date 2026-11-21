import type { ApiRequestConfig } from '../client';

import { describe, expect, it, vi } from 'vitest';

import { createApiClient } from '../client';
import {
  changeMyEmailApi,
  changeMyPasswordApi,
  getMyProfileApi,
  getMySessionsApi,
  logoutAllApi,
  logoutOthersApi,
  revokeMySessionApi,
  updateMyProfileApi,
  uploadMyAvatarApi,
  verifyMyEmailApi,
} from '../core/self-service';
import { envelope, respond } from './transport';

const calls = vi.hoisted(() => ({
  delete: vi.fn(),
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: calls }));

describe('personal account contracts', () => {
  it('uploads an avatar as multipart without overriding its browser boundary', async () => {
    const file = new File(['image'], 'avatar.png', { type: 'image/png' });
    const controller = new AbortController();
    await uploadMyAvatarApi(file, controller.signal);
    const [path, data, config] = calls.post.mock.lastCall ?? [];
    expect(path).toBe('/auth/profile/avatar');
    expect(data.get('file')).toBe(file);
    expect([...data.keys()]).toEqual(['file']);
    expect(config).toMatchObject({
      silent: true,
      preserveBusinessMessage: true,
      signal: controller.signal,
    });
    expect(config.headers['Content-Type']).toBeUndefined();
    expect(config.headers['Idempotency-Key']).toBeTruthy();
  });
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

  it('returns the server revocation count without sending a logout-others body', async () => {
    calls.post.mockResolvedValueOnce({ revoked: 7 });
    await expect(logoutOthersApi()).resolves.toEqual({ revoked: 7 });
    expect(calls.post).toHaveBeenCalledWith('/auth/logout-others', undefined, {
      silent: true,
    });
    calls.post.mockResolvedValueOnce({ revoked: 0 });
    await expect(logoutOthersApi()).resolves.toEqual({ revoked: 0 });
  });

  it('deletes an encoded own-session ID without using the management endpoint', async () => {
    calls.delete.mockResolvedValueOnce(undefined);
    await expect(revokeMySessionApi('other/sid')).resolves.toBeUndefined();
    expect(calls.delete).toHaveBeenCalledWith('/auth/sessions/other%2Fsid', {
      silent: true,
    });
  });

  it('updates editable fields without submitting authority fields', async () => {
    const input = { nickname: '新昵称', email: 'new@example.test', avatar: '' };
    await updateMyProfileApi(input);
    expect(calls.put).toHaveBeenCalledWith('/auth/profile', input, {
      preserveBusinessMessage: true,
      silent: true,
    });
  });

  it('requests email change separately and verifies without session credentials', async () => {
    await changeMyEmailApi('new@example.test');
    expect(calls.post).toHaveBeenCalledWith(
      '/auth/profile/email/change',
      { email: 'new@example.test' },
      {
        preserveBusinessMessage: true,
        silent: true,
      },
    );
    await verifyMyEmailApi('opaque');
    expect(calls.post).toHaveBeenCalledWith(
      '/auth/profile/email/verify',
      { token: 'opaque' },
      {
        preserveBusinessMessage: true,
        silent: true,
        authenticated: false,
      },
    );
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
