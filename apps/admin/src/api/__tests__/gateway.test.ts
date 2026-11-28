import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createGatewayClientApi,
  createGatewayRouteApi,
  createGatewaySecretApi,
  getGatewayCallsApi,
  getGatewayCallSummaryApi,
  getGatewayClientApi,
  getGatewayClientGrantsApi,
  getGatewayClientsApi,
  getGatewayInfoApi,
  getGatewayRoutesApi,
  getGatewaySecretsApi,
  revealGatewaySecretApi,
  revokeGatewayClientGrantApi,
  revokeGatewaySecretApi,
  saveGatewayClientGrantApi,
  tryGatewayClientApi,
  updateGatewayClientApi,
  updateGatewayRouteApi,
} from '../core/gateway';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());
const put = vi.hoisted(() => vi.fn());
const deleteRequest = vi.hoisted(() => vi.fn());
vi.mock('#/api/request', () => ({
  requestClient: { delete: deleteRequest, get, post, put },
}));

beforeEach(() => vi.clearAllMocks());

describe('gateway requests', () => {
  it('uses array endpoints for clients and routes', async () => {
    await getGatewayClientsApi();
    await getGatewayRoutesApi();
    expect(get).toHaveBeenCalledWith('/admin/api-clients', { silent: true });
    expect(get).toHaveBeenCalledWith('/admin/api-routes', { silent: true });
  });

  it('keeps the nested client creation response and initial secret together', async () => {
    const input = {
      ip_whitelist: [],
      name: '验收客户端',
      owner_user_id: 12,
    };
    const response = {
      client: { app_id: 'app-1', id: 9 },
      key: { id: 21, secret: 'one-time-secret' },
    };
    post.mockResolvedValueOnce(response);
    await expect(createGatewayClientApi(input)).resolves.toEqual(response);
    expect(post).toHaveBeenCalledWith('/admin/api-clients', input, {
      preserveBusinessMessage: true,
      silent: true,
    });
  });

  it('uses the reveal endpoint and never persists the secret', async () => {
    await revealGatewaySecretApi(9, 21);
    expect(get).toHaveBeenCalledWith('/admin/api-clients/9/secrets/21/reveal', {
      headers: { 'Cache-Control': 'no-store' },
      silent: true,
    });
  });

  it('updates client metadata and passes an empty whitelist through to the backend', async () => {
    await updateGatewayClientApi(9, {
      ip_whitelist: [],
      name: '新名称',
      status: 'suspended',
      version: 3,
    });
    expect(put).toHaveBeenCalledWith(
      '/admin/api-clients/9',
      {
        ip_whitelist: [],
        name: '新名称',
        status: 'suspended',
        version: 3,
      },
      { preserveBusinessMessage: true, silent: true },
    );
  });

  it('uses explicit client routes, secret and try endpoints', async () => {
    await getGatewaySecretsApi(9);
    await createGatewaySecretApi(9, 90);
    await revokeGatewaySecretApi(9, 21);
    expect(get).toHaveBeenCalledWith('/admin/api-clients/9/secrets', {
      silent: true,
    });
    expect(post).toHaveBeenCalledWith(
      '/admin/api-clients/9/secrets',
      { overlap_seconds: 90 },
      { preserveBusinessMessage: true, silent: true },
    );
    expect(deleteRequest).toHaveBeenCalledWith(
      '/admin/api-clients/9/secrets/21',
      {
        preserveBusinessMessage: true,
        silent: true,
      },
    );
  });

  it('loads a client and its grants and saves or revokes grants', async () => {
    const grant = {
      expires_at: null,
      quota_daily: 100,
      quota_monthly: 1000,
      route_id: 1,
      status: 'active' as const,
    };
    await getGatewayClientApi(42);
    await getGatewayClientGrantsApi(42);
    await saveGatewayClientGrantApi(42, grant);
    await revokeGatewayClientGrantApi(42, 77);
    expect(get).toHaveBeenCalledWith('/admin/api-clients/42', { silent: true });
    expect(get).toHaveBeenCalledWith('/admin/api-clients/42/routes', {
      silent: true,
    });
    expect(post).toHaveBeenCalledWith('/admin/api-clients/42/routes', grant, {
      preserveBusinessMessage: true,
      silent: true,
    });
    expect(deleteRequest).toHaveBeenCalledWith(
      '/admin/api-clients/42/routes/77',
      { preserveBusinessMessage: true, silent: true },
    );
  });

  it('posts the trial route id, query and body to the client trial endpoint', async () => {
    await tryGatewayClientApi(9, {
      body: { page: 1 },
      query: { state: 'open' },
      route_id: 1,
    });
    expect(post).toHaveBeenCalledWith(
      '/admin/api-clients/9/try',
      { body: { page: 1 }, query: { state: 'open' }, route_id: 1 },
      { preserveBusinessMessage: true, silent: true },
    );
  });

  it('sends call filters and summary grouping as query parameters', async () => {
    const query = { client_id: 9, page: 2, page_size: 10 };
    await getGatewayCallsApi(query);
    await getGatewayCallSummaryApi({ group_by: 'route' });
    expect(get).toHaveBeenCalledWith('/admin/api-calls', {
      params: query,
      silent: true,
    });
    expect(get).toHaveBeenCalledWith('/admin/api-calls/summary', {
      params: { group_by: 'route' },
      silent: true,
    });
  });

  it('preserves route version in the update payload and reads gateway info', async () => {
    const route = {
      billing_mode: 'per_call' as const,
      capability: 'order.status',
      code: 'acceptance.order.status',
      currency: 'CNY',
      method: 'GET' as const,
      name: '订单状态',
      path: '/open/v1/orders/:id/status',
      price_cents: 10,
      route_group: 'orders',
      status: 'enabled' as const,
      units_per_call: 1,
      version: 3,
      visibility: 'public' as const,
    };
    await createGatewayRouteApi(route);
    await updateGatewayRouteApi(4, route);
    await getGatewayInfoApi();
    expect(post).toHaveBeenCalledWith('/admin/api-routes', route, {
      preserveBusinessMessage: true,
      silent: true,
    });
    expect(put).toHaveBeenCalledWith('/admin/api-routes/4', route, {
      preserveBusinessMessage: true,
      silent: true,
    });
    expect(get).toHaveBeenCalledWith('/admin/gateway/info', { silent: true });
  });

  it('passes version conflicts through the shared API error boundary', async () => {
    const conflict = new Error('version conflict');
    put.mockRejectedValueOnce(conflict);
    await expect(
      updateGatewayRouteApi(4, {
        billing_mode: 'free',
        capability: 'order.status',
        code: 'acceptance.order.status',
        currency: 'CNY',
        method: 'GET',
        name: '订单状态',
        path: '/open/v1/orders/:id/status',
        price_cents: 0,
        route_group: 'orders',
        status: 'enabled',
        units_per_call: 1,
        version: 3,
        visibility: 'public',
      }),
    ).rejects.toBe(conflict);
  });
});
