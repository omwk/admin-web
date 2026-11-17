import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  archiveTenantApi,
  cloneTenantTemplateApi,
  createTenantTemplateApi,
  deleteTenantApi,
  deleteTenantTemplateApi,
  disableTenantApi,
  getAllTenantsApi,
  getAllTenantTemplatesApi,
  getTenantMembersApi,
  provisionTenantApi,
  reissueTenantAdminInviteApi,
  renameTenantApi,
  restoreTenantApi,
  updateTenantTemplateApi,
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
  it.each([false, true])(
    'keeps include_archived=%s consistent across pages',
    async (includeArchived) => {
      const pages: number[] = [];
      requestClient.instance.defaults.adapter = async (config) => {
        expect(config.url).toBe('/admin/tenants');
        expect(config.params.include_archived).toBe(
          includeArchived ? true : undefined,
        );
        pages.push(config.params.page);
        return respond(
          config,
          envelope({ list: [{ id: config.params.page }], total: 2 }),
        );
      };
      expect(await getAllTenantsApi(includeArchived)).toEqual([
        { id: 1 },
        { id: 2 },
      ]);
      expect(pages).toEqual([1, 2]);
    },
  );
  it('archives and restores without a request body', async () => {
    const paths: string[] = [];
    requestClient.instance.defaults.adapter = async (config) => {
      paths.push(config.url ?? '');
      expect(config.method).toBe('post');
      expect(config.data).toBeUndefined();
      return respond(config, envelope({ id: 8 }));
    };
    await archiveTenantApi(8);
    await restoreTenantApi(8);
    expect(paths).toEqual([
      '/admin/tenants/8/archive',
      '/admin/tenants/8/restore',
    ]);
  });
  it('url encodes the exact confirmation code and accepts an empty 204', async () => {
    const code = 'Acme /+?&中文';
    requestClient.instance.defaults.adapter = async (config) => {
      expect(config.method).toBe('delete');
      expect(config.url).toBe('/admin/tenants/8');
      expect(config.data).toBeUndefined();
      expect(config.params).toEqual({ confirm: code });
      const url = new URL(
        requestClient.instance.getUri(config),
        'http://localhost',
      );
      expect(url.searchParams.get('confirm')).toBe(code);
      expect(url.search).toContain('%26');
      return respond(config, undefined, 204);
    };
    expect(await deleteTenantApi(8, code)).toBeUndefined();
  });
  it('omits the source tenant for blank templates and uses the dedicated clone endpoint', async () => {
    const input = { code: 'readonly', name: '只读版', description: '' };
    requestClient.instance.defaults.adapter = async (config) => {
      expect(config.method).toBe('post');
      expect(config.url).toBe('/admin/tenant-templates');
      expect(JSON.parse(config.data)).toEqual(input);
      return respond(config, envelope({ id: 9, roles: [] }), 201);
    };
    expect(await createTenantTemplateApi(input)).toMatchObject({ roles: [] });
    requestClient.instance.defaults.adapter = async (config) => {
      expect(config.method).toBe('post');
      expect(config.url).toBe('/admin/tenant-templates/9/clone');
      expect(JSON.parse(config.data)).toEqual({ code: 'copy', name: '副本' });
      return respond(config, envelope({ id: 10 }), 201);
    };
    expect(
      await cloneTenantTemplateApi(9, { code: 'copy', name: '副本' }),
    ).toEqual({ id: 10 });
  });
  it.each([
    { roles: [] },
    {
      roles: [
        {
          code: 'reader',
          name: '只读',
          data_scope: 'self' as const,
          status: 'active' as const,
          remark: null,
          permissions: ['catalog:product:list'],
          menus: ['/catalog/product'],
        },
      ],
    },
  ])(
    'sends name and the complete roles array together, including empty replacement',
    async ({ roles }) => {
      const input = { name: '只读版', description: '说明', roles };
      requestClient.instance.defaults.adapter = async (config) => {
        expect(config.method).toBe('put');
        expect(config.url).toBe('/admin/tenant-templates/9');
        expect(JSON.parse(config.data)).toEqual(input);
        return respond(config, envelope({ id: 9, ...input }));
      };
      expect(await updateTenantTemplateApi(9, input)).toMatchObject(input);
    },
  );
  it('uses the member endpoint with explicit server pagination', async () => {
    requestClient.instance.defaults.adapter = async (config) => {
      expect(config.url).toBe('/admin/tenants/8/members');
      expect(config.params).toEqual({ page: 2, page_size: 20 });
      return respond(
        config,
        envelope({ list: [], page: 2, page_size: 20, total: 25 }),
      );
    };
    expect(await getTenantMembersApi(8, 2)).toMatchObject({
      page: 2,
      total: 25,
    });
  });
  it.each([false, true])(
    'sends force=%s only as an explicit query, without a body',
    async (force) => {
      requestClient.instance.defaults.adapter = async (config) => {
        expect(config.url).toBe('/admin/tenants/8/admin-invite');
        expect(config.method).toBe('post');
        expect(config.data).toBeUndefined();
        expect(config.params).toEqual(force ? { force: true } : undefined);
        return respond(
          config,
          envelope({
            invite_url: '/auth/invite/accept',
            expires_at: '2026-11-21T00:00:00Z',
          }),
          201,
        );
      };
      expect(await reissueTenantAdminInviteApi(8, force)).toHaveProperty(
        'expires_at',
      );
    },
  );
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
        () => archiveTenantApi(2),
        () => restoreTenantApi(2),
        () => deleteTenantApi(2, 'acme'),
        () =>
          provisionTenantApi({
            code: 'acme',
            name: 'Acme',
            template_id: 1,
            admin_username: 'admin',
          }),
        () => renameTenantApi(2, { name: 'New' }),
        () => disableTenantApi(1),
        () => reissueTenantAdminInviteApi(2),
        () => deleteTenantTemplateApi(1),
        () =>
          createTenantTemplateApi({
            code: 'blank',
            name: '空白',
            description: '',
          }),
        () =>
          updateTenantTemplateApi(1, {
            name: '模板',
            description: '',
            roles: [],
          }),
        () => cloneTenantTemplateApi(1, { code: 'copy', name: '副本' }),
      ];
      for (const action of actions)
        await expect(action()).rejects.toMatchObject({ message: text, status });
    },
  );
});
