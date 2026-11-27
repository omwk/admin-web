import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  activeGatewayGrants,
  parseIpWhitelist,
  parseTryQuery,
  secretPrefix,
  startSecretCountdown,
  tryBody,
} from '../options';

afterEach(() => vi.useRealTimers());

describe('gateway client options', () => {
  it('parses query rows, JSON bodies, and IP lists', () => {
    expect(parseTryQuery('page=1\nfilter=a=b')).toEqual({
      filter: 'a=b',
      page: '1',
    });
    expect(() => parseTryQuery('page=1\npage=2')).toThrow('参数名重复');
    expect(tryBody('{"page":1}')).toEqual({ page: 1 });
    expect(() => tryBody('{')).toThrow('有效 JSON');
    expect(parseIpWhitelist('192.0.2.1\n192.0.2.1, 2001:db8::1')).toEqual([
      '192.0.2.1',
      '2001:db8::1',
    ]);
  });

  it('only offers active grants without an expired validity date', () => {
    const now = Date.parse('2026-11-27T00:00:00.000Z');
    expect(
      activeGatewayGrants(
        [
          { expires_at: null, route_id: 1, status: 'active' },
          {
            expires_at: '2026-11-28T00:00:00.000Z',
            route_id: 2,
            status: 'active',
          },
          { expires_at: null, route_id: 3, status: 'suspended' },
          {
            expires_at: '2026-11-26T00:00:00.000Z',
            route_id: 4,
            status: 'active',
          },
        ],
        now,
      ).map((grant) => grant.route_id),
    ).toEqual([1, 2]);
  });

  it('normalizes the prefix field name used by create and reveal responses', () => {
    expect(secretPrefix({ secret_prefix: 'sk_live_' })).toBe('sk_live_');
    expect(secretPrefix({ prefix: 'sk_test_' })).toBe('sk_test_');
  });

  it('expires the in-memory secret at 60 seconds', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const onExpire = vi.fn();
    startSecretCountdown(onTick, onExpire);
    vi.advanceTimersByTime(59_000);
    expect(onExpire).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1000);
    expect(onTick).toHaveBeenLastCalledWith(0);
    expect(onExpire).toHaveBeenCalledOnce();
  });

  it('stops the secret timer when the dialog closes early', () => {
    vi.useFakeTimers();
    const onTick = vi.fn();
    const onExpire = vi.fn();
    const stop = startSecretCountdown(onTick, onExpire);
    vi.advanceTimersByTime(10_000);
    stop();
    vi.advanceTimersByTime(60_000);
    expect(onExpire).not.toHaveBeenCalled();
    expect(onTick).toHaveBeenCalledTimes(10);
  });
});
