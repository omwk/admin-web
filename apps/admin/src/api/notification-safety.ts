import { ApiError } from './errors';

const visibleConfigKeys = new Set([
  'from_name',
  'region',
  'sign_name',
  'template_code',
  'tls_mode',
]);
const configuredKeys = new Set([
  'access_key_id',
  'access_key_secret',
  'api_key',
  'endpoint',
  'from_address',
  'password',
  'secret',
  'smtp_addr',
  'username',
]);

/** Only presence flags and the backend's explicit non-sensitive allowlist enter UI state. */
export function safeProviderConfig(config: Record<string, unknown>) {
  const safe: Record<string, boolean | string> = {};
  for (const key of visibleConfigKeys) {
    if (typeof config[key] === 'string') safe[key] = config[key];
  }
  for (const key of configuredKeys) {
    if (config[`${key}_configured`] === true || Boolean(config[key]))
      safe[`${key}_configured`] = true;
  }
  return safe;
}

export function notificationError(
  error: unknown,
  privateValues: string[] = [],
) {
  let text = error instanceof Error ? error.message : '请求失败，请稍后重试';
  if (error instanceof ApiError && error.businessMessage)
    text = error.businessMessage;
  for (const value of privateValues
    .filter(Boolean)
    .toSorted((a, b) => b.length - a.length))
    text = text.split(value).join('已配置');
  return text;
}
