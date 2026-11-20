import type { StorageInput } from '#/api/model/storage';

export function emptyProvider(): StorageInput {
  return {
    name: '',
    endpoint: '',
    port: 443,
    use_ssl: true,
    path_style: true,
    bucket: '',
    region: 'us-east-1',
    access_key: '',
    secret_key: '',
    public_base_url: '',
    is_default: false,
    enabled: true,
  };
}

function endpointURL(
  input: Pick<StorageInput, 'endpoint' | 'port' | 'use_ssl'>,
) {
  const raw = input.endpoint.trim();
  const explicit = raw.includes('://');
  const url = new URL(
    explicit ? raw : `${input.use_ssl ? 'https' : 'http'}://${raw}`,
  );
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    (url.pathname !== '/' && url.pathname !== '') ||
    url.search ||
    url.hash
  )
    throw new Error('服务地址须为主机名或 http(s)://host:port，不含路径或凭据');
  const port = raw.match(/:(\d+)\/?$/)?.[1];
  return { url, explicit, port: Number(port ?? input.port) };
}

export function providerAddress(
  input: Pick<StorageInput, 'endpoint' | 'port' | 'use_ssl'>,
) {
  try {
    const { url, port } = endpointURL(input);
    return `${url.protocol}//${url.hostname}:${port}`;
  } catch {
    return input.endpoint;
  }
}

export function normalizeProvider(input: StorageInput): StorageInput {
  const { url, explicit, port } = endpointURL(input);
  return {
    access_key: input.access_key,
    secret_key: input.secret_key,
    enabled: input.enabled,
    is_default: input.is_default,
    path_style: input.path_style,
    name: input.name.trim(),
    bucket: input.bucket.trim(),
    endpoint: url.hostname,
    port,
    use_ssl: explicit ? url.protocol === 'https:' : input.use_ssl,
    region: input.region.trim() || 'us-east-1',
    public_base_url: input.public_base_url.trim(),
  };
}

export function validateProvider(input: StorageInput) {
  const errors: Record<string, string> = {};
  for (const [key, label] of [
    ['name', '名称'],
    ['bucket', '桶名'],
    ['access_key', 'Access Key'],
    ['secret_key', 'Secret Key'],
  ] as const)
    if (!input[key].trim()) errors[key] = `请输入${label}`;
  try {
    endpointURL(input);
  } catch {
    errors.endpoint = '请输入有效的服务地址，不含路径或凭据';
  }
  if (!Number.isInteger(input.port) || input.port < 1 || input.port > 65_535)
    errors.port = '端口须为 1–65535 的整数';
  if (input.public_base_url.trim()) {
    try {
      const url = new URL(input.public_base_url.trim());
      if (
        !['http:', 'https:'].includes(url.protocol) ||
        !url.hostname ||
        url.username ||
        url.password ||
        url.search ||
        url.hash
      )
        throw new Error('invalid prefix');
    } catch {
      errors.public_base_url = '请输入不含凭据、查询参数或片段的 HTTP(S) 地址';
    }
  }
  return errors;
}

export function connectionResult(status: string): {
  text: string;
  type: 'error' | 'success';
} {
  const labels: Record<string, string> = {
    ok: '连接正常',
    access_denied: '认证失败',
    bucket_missing: '桶不存在',
    unreachable: '网络不可达',
  };
  return {
    text: labels[status] ?? '连接测试返回未知状态，请重试',
    type: status === 'ok' ? 'success' : 'error',
  };
}
