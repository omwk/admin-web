import type { GatewayRouteDraft } from '../options';

import type { GatewayRoute } from '#/api/model/gateway';

import { describe, expect, it } from 'vitest';

import {
  applyGatewayCapability,
  gatewayCapabilities,
  normalizeGatewayRoute,
  validateGatewayRoute,
} from '../options';

const route: GatewayRouteDraft = {
  billing_mode: 'per_call',
  capability: 'order.status',
  code: 'order.status',
  currency: 'CNY',
  method: 'GET',
  name: '订单状态',
  path: '/open/v1/orders/:id/status',
  price_cents: 10,
  route_group: 'orders',
  status: 'enabled',
  units_per_call: 1,
  visibility: 'public',
};

describe('gateway route options', () => {
  it('requires an open path and per-call positive integer price and units', () => {
    expect(validateGatewayRoute(route)).toBe('');
    expect(validateGatewayRoute({ ...route, path: '/v1/orders' })).toContain(
      '/open/',
    );
    expect(validateGatewayRoute({ ...route, price_cents: 0 })).toContain(
      '价格必须',
    );
    expect(validateGatewayRoute({ ...route, units_per_call: 0 })).toContain(
      '每次用量',
    );
  });

  it('clears per-call-only fields for other billing modes', () => {
    const normalized = normalizeGatewayRoute({
      ...route,
      billing_mode: 'free',
    });
    expect(normalized.price_cents).toBe(0);
    expect(normalized.units_per_call).toBe(1);
    expect(normalized.currency).toBe('CNY');
  });

  it('requires CNY for per-call routes', () => {
    expect(validateGatewayRoute({ ...route, currency: 'USD' })).toContain(
      '币种必须是 CNY',
    );
  });

  it('uses only backend-registered capabilities and synchronizes route fields', () => {
    const draft = { ...route, capability: '', path: '', route_group: '' };
    applyGatewayCapability(draft, 'usage.read');
    expect(draft).toMatchObject({
      capability: 'usage.read',
      code: 'usage.read',
      method: 'GET',
      path: '/open/v1/usage',
      route_group: 'usage',
    });
    expect(gatewayCapabilities.map((item) => item.capability)).toEqual([
      'order.status',
      'usage.read',
    ]);
    expect(
      validateGatewayRoute({ ...route, capability: 'usage.read' }),
    ).toContain('code 必须');
  });

  it('keeps list rows typed with server version for optimistic updates', () => {
    const record: GatewayRoute = {
      ...route,
      currency: 'CNY',
      id: 5,
      version: 2,
    };
    expect(record.version).toBe(2);
  });

  it('does not include server-owned fields in the route write payload', () => {
    const editedDraft = {
      ...route,
      id: 5,
      version: 2,
    } as GatewayRouteDraft & { id: number; version: number };
    const input = normalizeGatewayRoute(editedDraft);
    expect(input).not.toHaveProperty('id');
    expect(input).not.toHaveProperty('version');
    expect(Object.keys(input).toSorted()).toEqual(
      [
        'billing_mode',
        'capability',
        'code',
        'currency',
        'method',
        'name',
        'path',
        'price_cents',
        'route_group',
        'status',
        'units_per_call',
        'visibility',
      ].toSorted(),
    );
  });
});
