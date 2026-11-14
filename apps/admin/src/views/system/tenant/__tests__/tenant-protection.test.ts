import type { Tenant, TenantTemplate } from '#/api/model/tenant';

import { createApp, h, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import TenantPage from '../index.vue';
import Templates from '../templates.vue';
import TenantActions from '../tenant-actions.vue';

const state = vi.hoisted(() => ({
  allowed: true,
  disable: vi.fn(),
  list: vi.fn(),
  templates: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/api/core/dictionaries', () => ({
  getMetaDictionaryApi: vi.fn().mockResolvedValue([]),
}));
vi.mock('#/auth/tenant', () => ({
  canViewTenants: () => true,
  canManageTenants: () => state.allowed,
  platformTenantId: 1,
}));
vi.mock('#/api/core/tenants', () => ({
  getAllTenantsApi: state.list,
  getAllTenantTemplatesApi: state.templates,
  disableTenantApi: state.disable,
  enableTenantApi: vi.fn(),
  renameTenantApi: vi.fn(),
  deleteTenantTemplateApi: state.remove,
  createTenantTemplateApi: vi.fn(),
  updateTenantTemplateApi: vi.fn(),
  getTenantTemplateApi: vi.fn(),
  provisionTenantApi: vi.fn(),
  reissueTenantAdminInviteApi: vi.fn(),
  getTenantMembersApi: vi.fn(),
}));
const tenant: Tenant = {
  id: 1,
  code: 'default',
  name: '平台',
  status: 'active',
  admin_active_count: 1,
  member_count: 1,
  provisioned_from: null,
  created_at: '2026-11-14T00:00:00Z',
  updated_at: '2026-11-14T00:00:00Z',
};
const template: TenantTemplate = {
  id: 3,
  code: 'standard',
  name: '标准',
  description: '',
  roles: [],
  menus: [],
  permissions: [],
  settings: {},
  created_at: tenant.created_at,
  updated_at: tenant.updated_at,
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
function buttons(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.textContent?.replaceAll(/\s/g, '') === text,
  );
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  state.list.mockResolvedValue([tenant]);
  state.templates.mockResolvedValue([template]);
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});
describe('tenant protections', () => {
  it('shows numeric monospace IDs, administrator counts and a red inactive badge', async () => {
    state.list.mockResolvedValue([
      tenant,
      { ...tenant, id: 8, code: 'acme', admin_active_count: 0 },
    ]);
    app = createApp(TenantPage);
    app.mount(root);
    await vi.waitFor(() => expect(root.textContent).toContain('acme'));
    const rows = root.querySelectorAll('tbody tr[data-row-key]');
    expect(rows[0]?.querySelector('td .font-mono')?.textContent).toBe('1');
    expect(rows[0]?.textContent).toContain('1 人');
    expect(rows[1]?.querySelector('.ant-tag-red')?.textContent).toBe('未激活');
    expect(buttons('查看成员')).toHaveLength(2);
  });
  it('disables platform suspension and hides its rename action', async () => {
    app = createApp(TenantActions, { tenant, disabled: false });
    app.mount(root);
    await nextTick();
    expect(buttons('停用')[0]?.disabled).toBe(true);
    expect(buttons('编辑名称')).toHaveLength(0);
    buttons('停用')[0]?.click();
    expect(state.disable).not.toHaveBeenCalled();
  });
  it('requires a confirmation with all three consequences, and cancel sends no request', async () => {
    app = createApp(TenantActions, {
      tenant: { ...tenant, id: 2 },
      disabled: false,
    });
    app.mount(root);
    buttons('停用')[0]?.click();
    await nextTick();
    const text = document.body.textContent;
    for (const line of [
      '该租户所有用户无法登录',
      '已登录会话的刷新令牌将被拒绝',
      '数据保留，可随时重新启用',
    ])
      expect(text).toContain(line);
    expect(state.disable).not.toHaveBeenCalled();
    buttons('取消')[0]?.click();
    await nextTick();
    expect(state.disable).not.toHaveBeenCalled();
    buttons('停用')[0]?.click();
    await nextTick();
    buttons('确认停用')[0]?.click();
    await vi.waitFor(() => expect(state.disable).toHaveBeenCalledWith(2));
  });
  it('protects templates referenced by suspended tenants and fails closed on unknown usage', async () => {
    const props = {
      templates: [template],
      tenants: [
        { ...tenant, id: 2, provisioned_from: 3, status: 'suspended' as const },
      ],
      loading: false,
      usageKnown: true,
    };
    app = createApp({ render: () => h(Templates, props) });
    app.mount(root);
    await nextTick();
    expect(buttons('删除模板')[0]?.disabled).toBe(true);
    app.unmount();
    app = createApp(Templates, { ...props, tenants: [], usageKnown: false });
    app.mount(root);
    await nextTick();
    expect(buttons('删除模板')[0]?.disabled).toBe(true);
    expect(buttons('生成模板')[0]?.disabled).toBe(true);
    expect(state.remove).not.toHaveBeenCalled();
  });
  it('hides all writes without manage and does not request the manage-only templates endpoint', async () => {
    state.allowed = false;
    app = createApp(TenantPage);
    app.mount(root);
    await vi.waitFor(() => expect(root.textContent).toContain('default'));
    for (const label of [
      '开通租户',
      '编辑名称',
      '停用',
      '启用',
      '生成模板',
      '删除模板',
      '重发管理员邀请',
      '重置管理员',
    ])
      expect(buttons(label)).toHaveLength(0);
    expect(root.textContent).not.toContain('租户模板');
    expect(state.templates).not.toHaveBeenCalled();
    expect(buttons('查看成员')).toHaveLength(1);
  });
});
