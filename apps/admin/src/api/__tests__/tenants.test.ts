import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  deleteTenantTemplateApi,
  disableTenantApi,
  getAllTenantsApi,
  getAllTenantTemplatesApi,
  provisionTenantApi,
  renameTenantApi,
} from '#/api/core/tenants';
import { requestClient } from '#/api/request';

import { envelope, respond } from './transport';

vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
vi.mock('#/auth/token', () => ({
  getAccessToken: () => 'fixture',
  getSessionVersion: () => 0,
}));
vi.mock('#/auth/refresh', () => ({ refreshAccessToken: vi.fn() }));
vi.mock('ant-design-vue', () => ({ message: { error: vi.fn() } }));

beforeEach(() => vi.clearAllMocks());
describe('tenant API contracts', () => {
  it('collects every tenant and template page, so references outside page one remain protected', async () => {
    const pages: number[] = [];
    requestClient.instance.defaults.adapter = async (config) => {
      const page = Number(config.params.page);
      pages.push(page);
      return respond(
        config,
        envelope({ list: [{ id: page }], page, page_size: 1, total: 3 }),
      );
    };
    expect(await getAllTenantsApi()).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
    expect(await getAllTenantTemplatesApi()).toEqual([
      { id: 1 },
      { id: 2 },
      { id: 3 },
    ]);
    expect(pages).toEqual([1, 2, 3, 1, 2, 3]);
  });
  it.each([400, 409])(
    'keeps the exact HTTP %i message for all tenant mutation paths',
    async (status) => {
      const text = '原始业务文案：请保留标点。';
      requestClient.instance.defaults.adapter = (config) =>
        respond(config, { ...envelope(null, 10_004), message: text }, status);
      const actions = [
        () =>
          provisionTenantApi({
            code: 'acme',
            name: 'Acme',
            template_id: 1,
            admin_username: 'admin',
          }),
        () => renameTenantApi(2, { name: 'New' }),
        () => disableTenantApi(1),
        () => deleteTenantTemplateApi(1),
      ];
      for (const action of actions)
        await expect(action()).rejects.toMatchObject({ message: text, status });
    },
  );
});
