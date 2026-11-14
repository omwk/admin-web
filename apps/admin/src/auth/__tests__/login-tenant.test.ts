import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import {
  getLastTenantCode,
  LOGIN_CREDENTIAL_ERROR,
  loginFailureMessage,
  rememberTenantCode,
  TENANT_CODE_KEY,
} from '../login-tenant';

beforeEach(() => {
  localStorage.clear();
  vi.unstubAllEnvs();
});

describe('tenant code login', () => {
  it('uses the configured default with a default-code fallback', () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_CODE', '');
    expect(getLastTenantCode()).toBe('default');
    vi.stubEnv('VITE_DEFAULT_TENANT_CODE', 'configured');
    expect(getLastTenantCode()).toBe('configured');
  });

  it('remembers only one trimmed code across sessions', () => {
    rememberTenantCode(' acme ');
    sessionStorage.clear();
    expect(getLastTenantCode()).toBe('acme');
    expect(localStorage.length).toBe(1);
    expect(localStorage.getItem(TENANT_CODE_KEY)).toBe('acme');
    rememberTenantCode('other');
    expect(localStorage.length).toBe(1);
    expect(getLastTenantCode()).toBe('other');
  });

  it('allows login when localStorage is unavailable', () => {
    vi.stubEnv('VITE_DEFAULT_TENANT_CODE', 'default');
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('unavailable');
    });
    expect(getLastTenantCode()).toBe('default');
    expect(() => rememberTenantCode('acme')).not.toThrow();
  });

  it.each([
    { code: 20_101, status: 401, message: '密码错误' },
    { code: 20_101, status: 401, message: '企业不存在' },
    { code: 10_003, status: 404, message: 'tenant not found' },
  ])('never reveals the reason for a credential rejection', (failure) => {
    expect(loginFailureMessage(new ApiError(failure))).toBe(
      LOGIN_CREDENTIAL_ERROR,
    );
  });

  it('keeps retry guidance for rate limits and unavailable services', () => {
    expect(
      loginFailureMessage(new ApiError({ code: 10_005, status: 429 })),
    ).toBe('请求过于频繁，请稍后重试');
    expect(loginFailureMessage(new ApiError({ status: 503 }))).toBe(
      '服务暂不可用，请稍后重试',
    );
  });
});
