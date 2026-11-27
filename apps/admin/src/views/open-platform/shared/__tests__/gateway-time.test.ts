import dayjs from 'dayjs';
import { describe, expect, it } from 'vitest';

import {
  formatGatewayCost,
  formatGatewayRate,
  gatewayRangeQuery,
  validateGatewayRange,
} from '../gateway-time';

describe('gateway time and metric formatting', () => {
  it('accepts at most a 30 day inclusive range and rejects 31 days', () => {
    const end = dayjs('2026-11-25T12:00:00.000Z');
    expect(validateGatewayRange([end.subtract(30, 'day'), end])).toBe('');
    expect(validateGatewayRange([end.subtract(31, 'day'), end])).toContain(
      '30 天',
    );
    expect(validateGatewayRange([end, end.subtract(1, 'hour')])).toContain(
      '开始时间',
    );
  });

  it('serializes filters as UTC and formats rates and cents', () => {
    const start = dayjs('2026-11-25T00:00:00.000Z');
    const end = start.add(1, 'day');
    expect(gatewayRangeQuery([start, end])).toEqual({
      from: start.toISOString(),
      to: end.toISOString(),
    });
    expect(formatGatewayRate(0.9876)).toBe('98.76%');
    expect(formatGatewayCost(1250)).toBe('CNY 12.50');
  });
});
