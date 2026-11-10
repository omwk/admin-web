import { beforeEach, describe, expect, it, vi } from 'vitest';

import { envelope, respond } from '#/api/__tests__/transport';
import { createApiClient } from '#/api/client';
import { ApiError } from '#/api/errors';

import { createRefreshCoordinator } from '../refresh';
import {
  clearTokens,
  getAccessToken,
  getRefreshToken,
  getSessionVersion,
  REFRESH_TOKEN_KEY,
  setTokens,
} from '../token';

function dumpStorage(store: Storage): string {
  const entries: string[] = [];
  for (let index = 0; index < store.length; index += 1) {
    const key = store.key(index) ?? '';
    entries.push(`${key}=${store.getItem(key) ?? ''}`);
  }
  return entries.join('&');
}

vi.mock('#/api/core/auth', () => ({ refreshTokenApi: vi.fn() }));

const pair = {
  access_token: 'access-new',
  expires_in: 900,
  refresh_token: 'refresh-new',
  token_type: 'Bearer' as const,
};

function setup(request = vi.fn(async (_token: string) => pair)) {
  const expired = vi.fn();
  const delay = vi.fn(async (_milliseconds: number) => {});
  const refresh = createRefreshCoordinator({
    delay,
    getRefreshToken,
    getSessionVersion,
    onSessionExpired: expired,
    request,
    setTokens,
  });
  return { delay, expired, refresh, request };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  clearTokens();
  setTokens({
    ...pair,
    access_token: 'access-old',
    refresh_token: 'refresh-old',
  });
});

describe('credential storage and refresh coordination', () => {
  it('stores only refresh in sessionStorage and access only in memory', () => {
    expect(getAccessToken()).toBe('access-old');
    expect(getRefreshToken()).toBe('refresh-old');
    expect(sessionStorage.getItem(REFRESH_TOKEN_KEY)).toBe('refresh-old');
    expect(localStorage.length).toBe(0);
    expect(dumpStorage(sessionStorage)).not.toContain('access-old');
  });

  it('restores refresh after module reload while discarding access', async () => {
    vi.resetModules();
    const reloaded = await import('../token');
    expect(reloaded.getAccessToken()).toBeNull();
    expect(reloaded.getRefreshToken()).toBe('refresh-old');
  });

  it('refreshes exactly once for five expired requests and replays all five silently', async () => {
    const { refresh, request } = setup();
    const notify = vi.fn();
    const client = createApiClient(
      '/api/v1',
      {
        getAccessToken,
        getSessionVersion,
        onSessionExpired: vi.fn(),
        refreshAccessToken: refresh,
      },
      notify,
    );
    let original = 0;
    let replayed = 0;
    client.instance.defaults.adapter = async (config) => {
      if (config.headers.Authorization === 'Bearer access-old') {
        original++;
        return respond(config, envelope(null, 20_102), 401);
      }
      replayed++;
      return respond(config, envelope(config.url));
    };
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) => client.get(`/test/${i}`)),
    );
    expect(results).toEqual([
      '/test/0',
      '/test/1',
      '/test/2',
      '/test/3',
      '/test/4',
    ]);
    expect({ original, replayed }).toEqual({ original: 5, replayed: 5 });
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('refresh-old');
    expect(getRefreshToken()).toBe('refresh-new');
    expect(notify).not.toHaveBeenCalled();
  });

  it('retries 20109 silently with bounded backoff and the latest stored refresh', async () => {
    const request = vi
      .fn(async (_token: string) => pair)
      .mockRejectedValueOnce(new ApiError({ code: 20_109, status: 409 }))
      .mockRejectedValueOnce(new ApiError({ code: 20_109, status: 401 }));
    const { delay, expired, refresh } = setup(request);
    await expect(Promise.all([refresh(), refresh()])).resolves.toEqual([
      'access-new',
      'access-new',
    ]);
    expect(request).toHaveBeenCalledTimes(3);
    expect(delay.mock.calls.map(([ms]) => ms)).toEqual([400, 800]);
    expect(expired).not.toHaveBeenCalled();
  });

  it('bounds repeated 20109 below the backend 30-second replay window', async () => {
    const request = vi
      .fn(async (_token: string) => pair)
      .mockRejectedValue(new ApiError({ code: 20_109, status: 409 }));
    const { delay, expired, refresh } = setup(request);
    await expect(refresh()).rejects.toMatchObject({ code: 20_109 });
    expect(request).toHaveBeenCalledTimes(5);
    expect(delay.mock.calls.reduce((sum, [ms]) => sum + ms, 0)).toBe(6000);
    expect(expired).not.toHaveBeenCalled();
  });

  it.each([20_101, 20_103])(
    'expires the session once and rejects every waiter for %i',
    async (code) => {
      const request = vi
        .fn(async (_token: string) => pair)
        .mockRejectedValue(new ApiError({ code, status: 401 }));
      const { expired, refresh } = setup(request);
      const results = await Promise.allSettled(
        Array.from({ length: 5 }, () => refresh()),
      );
      expect(results.every((result) => result.status === 'rejected')).toBe(
        true,
      );
      expect(expired).toHaveBeenCalledTimes(1);
      expect(request).toHaveBeenCalledTimes(1);
    },
  );

  it('does not discard the session on temporary backend failures', async () => {
    const request = vi
      .fn(async (_token: string) => pair)
      .mockRejectedValueOnce(new ApiError({ code: 10_002, status: 503 }));
    const { expired, refresh } = setup(request);
    await expect(refresh()).rejects.toMatchObject({ code: 10_002 });
    expect(expired).not.toHaveBeenCalled();
    expect(getRefreshToken()).toBe('refresh-old');
    await expect(refresh()).resolves.toBe('access-new');
  });

  it('never resurrects tokens when logout overtakes an in-flight refresh', async () => {
    let finish!: (value: typeof pair) => void;
    const request = vi.fn(
      (_token: string) =>
        new Promise<typeof pair>((resolve) => {
          finish = resolve;
        }),
    );
    const { expired, refresh } = setup(request);
    const pending = refresh();
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(1));
    clearTokens();
    finish(pair);
    await expect(pending).rejects.toMatchObject({ code: 'ERR_CANCELED' });
    expect(getAccessToken()).toBeNull();
    expect(getRefreshToken()).toBeNull();
    expect(expired).not.toHaveBeenCalled();
  });
});
