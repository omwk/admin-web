import { toApiError } from '#/api/errors';

export const TENANT_CODE_KEY = `${import.meta.env.VITE_APP_NAMESPACE || 'admin-web'}:last-tenant-code`;
export const LOGIN_CREDENTIAL_ERROR = '企业代码、账号或密码错误';

export function getLastTenantCode(): string {
  const fallback =
    import.meta.env.VITE_DEFAULT_TENANT_CODE?.trim() || 'default';
  try {
    return localStorage.getItem(TENANT_CODE_KEY)?.trim() || fallback;
  } catch {
    return fallback;
  }
}

export function rememberTenantCode(code: string) {
  try {
    localStorage.setItem(TENANT_CODE_KEY, code.trim());
  } catch {
    // Remembering the enterprise is optional; authentication must still work.
  }
}

export function loginFailureMessage(failure: unknown): string {
  const error = toApiError(failure);
  if (
    error.status === 403 &&
    error.code === 20_111 &&
    error.businessMessage === '请先完成邮箱验证'
  )
    return '请先完成邮箱验证';
  if (
    error.code === 20_101 ||
    (error.status &&
      error.status >= 400 &&
      error.status < 500 &&
      error.status !== 429)
  ) {
    return LOGIN_CREDENTIAL_ERROR;
  }
  return error.message;
}
