import { createApp, nextTick } from 'vue';

import { initStores, useAccessStore, useUserStore } from '@vben/stores';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { envelope, respond } from '#/api/__tests__/transport';
import { baseRequestClient, requestClient } from '#/api/request';
import { useAuthStore } from '#/store/auth';

import { initializeAuthState } from '../persistence';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  REFRESH_TOKEN_KEY,
} from '../token';

function dumpStorage(store: Storage): string {
  const entries: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index) ?? '';
    entries.push(`${key}=${store.getItem(key) ?? ''}`);
  }
  return entries.join('&');
}

const mocks = vi.hoisted(() => ({
  error: vi.fn(),
  replace: vi.fn(async (_location: unknown) => {}),
  resetRoutes: vi.fn(),
  success: vi.fn(),
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('ant-design-vue', () => ({
  message: { error: mocks.error },
  notification: { success: mocks.success },
}));
vi.mock('#/locales', () => ({ $t: (key: string) => key }));
vi.mock('#/router', () => ({
  resetRoutes: mocks.resetRoutes,
  router: {
    currentRoute: {
      value: { fullPath: '/auth/login', path: '/auth/login', query: {} },
    },
    replace: mocks.replace,
  },
}));

const pair = {
  access_token: 'real-access-fixture',
  expires_in: 900,
  refresh_token: 'real-refresh-fixture',
  token_type: 'Bearer',
};
const overview = {
  permissions: ['system:user:list'],
  user: {
    dept_id: 1,
    id: 7,
    is_super: false,
    nickname: '测试用户',
    roles: [{ code: 'operator', id: 2, name: '运营' }],
    tenant_id: 1,
    username: 'operator',
  },
};
const createTestApp = () => createApp({});

beforeEach(async () => {
  vi.clearAllMocks();
  clearTokens();
  localStorage.clear();
  sessionStorage.clear();
  await initStores(createTestApp(), { namespace: 'fe1-test' });
  initializeAuthState();
});

describe('application authentication flow', () => {
  it('passes an explicit tenant to login and retains the authoritative platform identity', async () => {
    let payload: unknown;
    requestClient.instance.defaults.adapter = async (config) => {
      if (config.url === '/auth/login') {
        payload = JSON.parse(config.data as string);
        return respond(config, envelope(pair));
      }
      return respond(
        config,
        envelope({
          ...overview,
          user: { ...overview.user, tenant_id: 8, is_super: true },
        }),
      );
    };
    await useAuthStore().authLogin({
      username: 'tenant-admin',
      password: 'test-password',
      tenant_id: 8,
    });
    expect(payload).toEqual({
      username: 'tenant-admin',
      password: 'test-password',
      tenant_id: 8,
    });
    expect(useUserStore().userInfo).toMatchObject({
      tenantId: 8,
      isSuper: true,
    });
  });
  it('logs in with snake_case tokens, fetches /auth/me and navigates without persisting access', async () => {
    const calls: string[] = [];
    let loginPayload: unknown;
    let loginAuthHeader: unknown;
    let meAuthHeader: unknown;
    requestClient.instance.defaults.adapter = async (config) => {
      calls.push(config.url ?? '');
      if (config.url === '/auth/login') {
        loginPayload = JSON.parse(config.data as string);
        loginAuthHeader = config.headers.Authorization;
        return respond(config, envelope(pair));
      }
      meAuthHeader = config.headers.Authorization;
      return respond(config, envelope(overview));
    };
    await useAuthStore().authLogin({
      username: 'operator',
      password: 'test-password',
    });
    await nextTick();
    expect(loginPayload).toEqual({
      username: 'operator',
      password: 'test-password',
    });
    expect(loginAuthHeader).toBeUndefined();
    expect(meAuthHeader).toBe('Bearer real-access-fixture');
    expect(calls).toEqual(['/auth/login', '/auth/me']);
    expect(getAccessToken()).toBe(pair.access_token);
    expect(getRefreshToken()).toBe(pair.refresh_token);
    expect(useUserStore().userInfo).toMatchObject({
      realName: '测试用户',
      roles: ['operator'],
      userId: '7',
    });
    expect(useAccessStore().accessToken).toBeNull();
    expect(mocks.replace).toHaveBeenCalled();
    expect(mocks.success).toHaveBeenCalledTimes(1);
    expect(dumpStorage(localStorage)).not.toContain(pair.access_token);
    expect(dumpStorage(localStorage)).not.toContain(pair.refresh_token);
  });

  it('restores a reloaded tab by POSTing refresh_token, without cookies or Bearer', async () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'stored-refresh');
    baseRequestClient.instance.defaults.adapter = async (config) => {
      expect(config.url).toBe('/auth/refresh');
      expect(config.withCredentials).not.toBe(true);
      expect(config.headers.Authorization).toBeUndefined();
      expect(JSON.parse(config.data as string)).toEqual({
        refresh_token: 'stored-refresh',
      });
      return respond(config, envelope(pair));
    };
    await expect(useAuthStore().restoreSession()).resolves.toBe(true);
    expect(getAccessToken()).toBe(pair.access_token);
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe(pair.refresh_token);
  });

  it('clears legacy framework persistence before protected navigation', async () => {
    localStorage.setItem(
      'legacy-core-access',
      JSON.stringify({
        accessToken: 'legacy-access',
        refreshToken: 'legacy-refresh',
        accessCodes: ['system:user:create'],
      }),
    );
    await initStores(createTestApp(), { namespace: 'legacy' });
    initializeAuthState();
    expect(useAccessStore().accessToken).toBeNull();
    expect(useAccessStore().accessCodes).toEqual([]);
    expect(localStorage.getItem('legacy-core-access')).not.toContain(
      'legacy-access',
    );
    expect(localStorage.getItem('legacy-core-access')).not.toContain(
      'legacy-refresh',
    );
  });

  it('expires revoked sessions without sending a refresh request', async () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'revoked-refresh');
    baseRequestClient.instance.defaults.adapter = (config) =>
      respond(config, envelope(pair));
    await useAuthStore().restoreSession();
    const refresh = vi.fn();
    baseRequestClient.instance.defaults.adapter = refresh;
    requestClient.instance.defaults.adapter = (config) =>
      respond(config, envelope(null, 20_101), 401);
    await expect(requestClient.get('/auth/me')).rejects.toMatchObject({
      code: 20_101,
    });
    expect(refresh).not.toHaveBeenCalled();
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(useUserStore().userInfo).toBeNull();
    expect(mocks.replace).toHaveBeenCalledWith({
      path: '/auth/login',
      query: {},
    });
  });

  it('logs out using the captured Bearer and handles the empty HTTP 204 response', async () => {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, 'stored-refresh');
    baseRequestClient.instance.defaults.adapter = (config) =>
      respond(config, envelope(pair));
    await useAuthStore().restoreSession();
    baseRequestClient.instance.defaults.adapter = (config) => {
      expect(config.url).toBe('/auth/logout');
      expect(config.headers.Authorization).toBe(`Bearer ${pair.access_token}`);
      expect(getAccessToken()).toBeNull();
      return respond(config, '', 204);
    };
    await useAuthStore().logout(false);
    expect(getRefreshToken()).toBeNull();
    expect(mocks.resetRoutes).toHaveBeenCalled();
  });
});
