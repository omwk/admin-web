import { describe, expect, it } from 'vitest';

import {
  connectionResult,
  normalizeProvider,
  providerAddress,
  validateProvider,
} from '../options';

const input = {
  name: '验收配置',
  endpoint: 'https://objects.example.invalid:9443',
  port: 443,
  use_ssl: true,
  path_style: true,
  bucket: 'files',
  region: 'us-east-1',
  access_key: 'example',
  secret_key: '',
  public_base_url: '',
  enabled: true,
  is_default: false,
};

describe('storage configuration boundaries', () => {
  it('sends only editable API fields when editing a server projection', () => {
    const server = {
      ...input,
      id: 42,
      created_at: '2026-11-20',
      updated_at: '2026-11-20',
    };
    const normalized = normalizeProvider(server);
    expect(Object.keys(normalized).toSorted()).toEqual(
      Object.keys(input).toSorted(),
    );
    expect(normalized).not.toHaveProperty('id');
    expect(normalized.port).toBe(9443);
  });

  it('keeps explicit default ports and uses the port field when a URL has no port', () => {
    expect(
      normalizeProvider({ ...input, endpoint: 'https://host:443', port: 9443 })
        .port,
    ).toBe(443);
    expect(
      normalizeProvider({ ...input, endpoint: 'http://host', port: 9000 }),
    ).toMatchObject({ endpoint: 'host', port: 9000, use_ssl: false });
  });

  it('requires a secret, valid authority, bounded port and an absolute public prefix', () => {
    expect(validateProvider(input).secret_key).toBeTruthy();
    expect(
      validateProvider({ ...input, endpoint: 'https://host/path' }).endpoint,
    ).toBeTruthy();
    expect(validateProvider({ ...input, port: 65_536 }).port).toBeTruthy();
    expect(
      validateProvider({ ...input, public_base_url: 'javascript:alert(1)' })
        .public_base_url,
    ).toBeTruthy();
  });

  it('uses explicit URL scheme/port when rendering an endpoint', () => {
    expect(providerAddress(input)).toBe('https://objects.example.invalid:9443');
    expect(
      providerAddress({ ...input, endpoint: 'objects.example.invalid' }),
    ).toBe('https://objects.example.invalid:443');
  });

  it('reports all four backend outcomes and treats unknown outcomes as failures', () => {
    expect(connectionResult('ok')).toEqual({
      text: '连接正常',
      type: 'success',
    });
    expect(connectionResult('access_denied').text).toBe('认证失败');
    expect(connectionResult('bucket_missing').text).toBe('桶不存在');
    expect(connectionResult('unreachable').text).toBe('网络不可达');
    expect(connectionResult('unexpected').type).toBe('error');
  });
});
