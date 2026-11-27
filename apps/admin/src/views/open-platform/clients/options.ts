export function secretPrefix(
  secret: { prefix: string } | { secret_prefix: string },
) {
  return 'secret_prefix' in secret ? secret.secret_prefix : secret.prefix;
}

export function parseTryQuery(value: string): Record<string, string> {
  const query: Record<string, string> = {};
  for (const [index, line] of value.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const separator = trimmed.indexOf('=');
    const key = trimmed.slice(0, separator).trim();
    if (separator <= 0 || !key)
      throw new Error(`第 ${index + 1} 行格式应为 key=value`);
    if (Object.hasOwn(query, key))
      throw new Error(`第 ${index + 1} 行参数名重复：${key}`);
    query[key] = trimmed.slice(separator + 1).trim();
  }
  return query;
}

export function tryBody(value: string): unknown {
  if (!value.trim()) return undefined;
  try {
    return JSON.parse(value);
  } catch {
    throw new Error('Body 必须是有效 JSON');
  }
}

export function activeGatewayGrants<
  T extends {
    expires_at: null | string;
    status: string;
  },
>(grants: T[], now = Date.now()) {
  return grants.filter(
    (grant) =>
      grant.status === 'active' &&
      (!grant.expires_at || Date.parse(grant.expires_at) > now),
  );
}

export function parseIpWhitelist(value: string) {
  return [
    ...new Set(
      value
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
}

export function startSecretCountdown(
  onTick: (secondsRemaining: number) => void,
  onExpire: () => void,
) {
  let secondsRemaining = 60;
  const timer = setInterval(() => {
    secondsRemaining -= 1;
    onTick(secondsRemaining);
    if (secondsRemaining <= 0) {
      clearInterval(timer);
      onExpire();
    }
  }, 1000);
  return () => clearInterval(timer);
}
