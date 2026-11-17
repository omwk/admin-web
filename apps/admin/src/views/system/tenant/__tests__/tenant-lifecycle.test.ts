import type { ApiRequestConfig } from '#/api/client';
import type { Tenant } from '#/api/model/tenant';

import { createApp, h, nextTick, reactive, ref } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import TenantPage from '../index.vue';
import TenantActions from '../tenant-actions.vue';
import TenantStatus from '../tenant-status.vue';

const route = reactive({ path: '/system/tenants' });
const state = vi.hoisted(() => ({
  allowed: true,
  archive: vi.fn(),
  restore: vi.fn(),
  purge: vi.fn(),
  list: vi.fn(),
  templates: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('vue-router', () => ({
  useRoute: () => route,
  useRouter: () => ({ push: vi.fn() }),
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
  archiveTenantApi: state.archive,
  restoreTenantApi: state.restore,
  deleteTenantApi: state.purge,
  disableTenantApi: vi.fn(),
  enableTenantApi: vi.fn(),
  renameTenantApi: vi.fn(),
  deleteTenantTemplateApi: vi.fn(),
  createTenantTemplateApi: vi.fn(),
  cloneTenantTemplateApi: vi.fn(),
  updateTenantTemplateApi: vi.fn(),
  getTenantTemplateApi: vi.fn(),
  provisionTenantApi: vi.fn(),
  reissueTenantAdminInviteApi: vi.fn(),
  getTenantMembersApi: vi.fn(),
}));
const tenant: Tenant = {
  id: 8,
  code: 'Acme',
  name: '测试租户',
  status: 'active',
  deleted_at: null,
  admin_active_count: 0,
  member_count: 0,
  provisioned_from: null,
  created_at: '2026-11-17T00:00:00Z',
  updated_at: '2026-11-17T00:00:00Z',
};
const archived = {
  ...tenant,
  status: 'suspended' as const,
  deleted_at: '2026-11-09T00:00:00Z',
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
function buttons(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
    (button) => button.textContent?.replaceAll(/\s/g, '') === text,
  );
}
function required<T>(value: null | T | undefined): T {
  if (value === null || value === undefined)
    throw new Error('Expected a rendered element');
  return value;
}
function firstButton(text: string) {
  return required(buttons(text)[0]);
}
function mountActions(value = tenant) {
  app = createApp(TenantActions, { tenant: value, disabled: false });
  app.mount(root);
}
async function confirmCode(value: string) {
  const input = required(
    document.querySelector<HTMLInputElement>('[aria-label="租户代码确认"]'),
  );
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  route.path = '/system/tenants';
  state.list.mockReset().mockResolvedValue([tenant]);
  state.templates.mockResolvedValue([]);
  state.archive.mockReset().mockResolvedValue(archived);
  state.restore.mockReset().mockResolvedValue(tenant);
  state.purge.mockReset().mockResolvedValue(undefined);
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
  message.destroy();
});
describe('tenant lifecycle', () => {
  it.each([
    [tenant, '正常', 'green'],
    [{ ...tenant, status: 'suspended' as const }, '已停用', 'default'],
    [archived, '已归档', 'red'],
    [{ ...archived, status: 'active' as const }, '已归档', 'red'],
  ])(
    'renders the status and gives archival time priority',
    async (value, label, color) => {
      app = createApp(TenantStatus, { tenant: value });
      app.mount(root);
      await nextTick();
      expect(root.querySelector(`.ant-tag-${color}`)?.textContent).toBe(label);
      expect(root.textContent?.includes('归档时间')).toBe(
        Boolean(value.deleted_at),
      );
      expect(root.textContent?.includes('2026-11-09')).toBe(
        Boolean(value.deleted_at),
      );
    },
  );
  it('switches server filtering on and off and ignores stale list responses', async () => {
    let finish!: (value: Tenant[]) => void;
    state.list.mockImplementationOnce(
      () =>
        new Promise<Tenant[]>((resolve) => {
          finish = resolve;
        }),
    );
    state.list
      .mockResolvedValueOnce([tenant, archived])
      .mockResolvedValueOnce([tenant]);
    app = createApp(TenantPage);
    app.mount(root);
    await nextTick();
    expect(state.list).toHaveBeenNthCalledWith(1, false);
    const toggle = required(
      root.querySelector<HTMLButtonElement>('[role="switch"]'),
    );
    expect(toggle.getAttribute('aria-label')).toBe('包含已归档');
    toggle.click();
    await vi.waitFor(() => expect(root.textContent).toContain('已归档'));
    expect(state.list).toHaveBeenNthCalledWith(2, true);
    finish([{ ...tenant, code: 'stale' }]);
    await nextTick();
    expect(root.textContent).not.toContain('stale');
    toggle.click();
    await vi.waitFor(() =>
      expect(state.list).toHaveBeenNthCalledWith(3, false),
    );
    await vi.waitFor(() =>
      expect(root.textContent).not.toContain('已归档归档时间'),
    );
    expect(root.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(1);
  });
  it('includes archived template references independently of the list filter', async () => {
    state.list.mockResolvedValue([{ ...archived, provisioned_from: 3 }]);
    state.templates.mockResolvedValue([
      {
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
      },
    ]);
    app = createApp(TenantPage);
    app.mount(root);
    await vi.waitFor(() => expect(state.list).toHaveBeenCalledWith(false));
    route.path = '/system/tenants/templates';
    await vi.waitFor(() => expect(state.list).toHaveBeenLastCalledWith(true));
    await vi.waitFor(() => expect(root.textContent).toContain('1 个租户'));
    expect(firstButton('删除模板').disabled).toBe(true);
    firstButton('从租户创建').click();
    await nextTick();
    expect(
      document.querySelector('[role="dialog"]')?.textContent,
    ).not.toContain(tenant.name);
    firstButton('取消').click();
    await nextTick();
    route.path = '/system/tenants';
    await vi.waitFor(() => expect(state.list).toHaveBeenLastCalledWith(false));
  });
  it.each([tenant, { ...tenant, status: 'suspended' as const }, archived])(
    'shows only actions valid for the current state',
    async (value) => {
      mountActions(value);
      await nextTick();
      expect(buttons('归档')).toHaveLength(value.deleted_at ? 0 : 1);
      expect(buttons('恢复')).toHaveLength(value.deleted_at ? 1 : 0);
      expect(buttons('彻底删除')).toHaveLength(value.deleted_at ? 1 : 0);
      expect(buttons('查看成员')).toHaveLength(value.deleted_at ? 0 : 1);
      expect(buttons('编辑名称')).toHaveLength(value.deleted_at ? 0 : 1);
      expect(buttons('停用')).toHaveLength(
        !value.deleted_at && value.status === 'active' ? 1 : 0,
      );
      expect(buttons('启用')).toHaveLength(
        !value.deleted_at && value.status === 'suspended' ? 1 : 0,
      );
      expect(buttons('重发管理员邀请')).toHaveLength(value.deleted_at ? 0 : 1);
    },
  );
  it.each([tenant, archived])(
    'disables platform archive/delete and exposes the exact tooltip',
    async (value) => {
      mountActions({ ...value, id: 1 });
      await nextTick();
      const button = firstButton(value.deleted_at ? '彻底删除' : '归档');
      expect(button.disabled).toBe(true);
      required(button.parentElement).dispatchEvent(
        new MouseEvent('mouseenter', { bubbles: true }),
      );
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain('平台租户不可归档/删除'),
      );
      button.click();
      expect(state.archive).not.toHaveBeenCalled();
      expect(state.purge).not.toHaveBeenCalled();
    },
  );
  it('requires archive confirmation, explains consequences, and refreshes the current filtered list', async () => {
    state.list.mockResolvedValueOnce([tenant]).mockResolvedValueOnce([]);
    app = createApp(TenantPage);
    app.mount(root);
    await vi.waitFor(() => expect(buttons('归档')).toHaveLength(1));
    firstButton('归档').click();
    await nextTick();
    for (const text of [
      '该租户用户立即无法登录',
      '租户从列表隐藏（可勾选「包含已归档」查看）',
      '数据保留，可随时恢复',
    ])
      expect(document.body.textContent).toContain(text);
    firstButton('取消').click();
    await nextTick();
    expect(state.archive).not.toHaveBeenCalled();
    firstButton('归档').click();
    await nextTick();
    firstButton('确认归档').click();
    await vi.waitFor(() => expect(state.archive).toHaveBeenCalledWith(8));
    await vi.waitFor(() => expect(state.list).toHaveBeenCalledTimes(2));
    expect(state.list).toHaveBeenLastCalledWith(false);
    await vi.waitFor(() =>
      expect(root.querySelectorAll('tbody tr[data-row-key]')).toHaveLength(0),
    );
  });
  it('restores archived tenants and emits one refresh', async () => {
    const changed = vi.fn();
    app = createApp(TenantActions, {
      tenant: archived,
      disabled: false,
      onChanged: changed,
    });
    app.mount(root);
    firstButton('恢复').click();
    await vi.waitFor(() => expect(state.restore).toHaveBeenCalledWith(8));
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
  });
  it('requires exact case and whitespace, resets confirmation after cancelling, and blocks duplicate deletes', async () => {
    let finish!: () => void;
    state.purge.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          finish = resolve;
        }),
    );
    const changed = vi.fn();
    app = createApp(TenantActions, {
      tenant: archived,
      disabled: false,
      onChanged: changed,
    });
    app.mount(root);
    firstButton('彻底删除').click();
    await nextTick();
    expect(document.body.textContent).toContain('此操作不可恢复');
    expect(document.body.textContent).not.toMatch(/\d+ 条业务数据|\d+ 个用户/);
    for (const code of ['', 'acme', 'Acme ', ' Acme']) {
      await confirmCode(code);
      expect(firstButton('删除').disabled).toBe(true);
      firstButton('删除').click();
    }
    expect(state.purge).not.toHaveBeenCalled();
    await confirmCode('Acme');
    expect(firstButton('删除').disabled).toBe(false);
    firstButton('取消').click();
    await nextTick();
    firstButton('彻底删除').click();
    await nextTick();
    expect(firstButton('删除').disabled).toBe(true);
    await confirmCode('Acme');
    firstButton('删除').click();
    firstButton('删除').click();
    await nextTick();
    expect(state.purge).toHaveBeenCalledExactlyOnceWith(8, 'Acme');
    expect(firstButton('取消').disabled).toBe(true);
    finish();
    await vi.waitFor(() => expect(changed).toHaveBeenCalledTimes(1));
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('租户已删除'),
    );
  });
  it.each([
    [400, '确认码不匹配'],
    [409, '归档未满 7 天'],
    [409, '租户仍有业务数据，暂不支持彻底删除'],
  ])(
    'keeps HTTP %i backend text in the dialog and allows retry',
    async (status, text) => {
      state.purge.mockRejectedValueOnce(
        new ApiError({
          status,
          message: text,
          config: { preserveBusinessMessage: true } as ApiRequestConfig,
        }),
      );
      mountActions(archived);
      firstButton('彻底删除').click();
      await nextTick();
      await confirmCode('Acme');
      firstButton('删除').click();
      await vi.waitFor(() =>
        expect(
          document.querySelector('[role="dialog"]')?.textContent,
        ).toContain(text),
      );
      expect(firstButton('删除').disabled).toBe(false);
      firstButton('删除').click();
      await vi.waitFor(() => expect(state.purge).toHaveBeenCalledTimes(2));
    },
  );
  it.each([tenant, archived])(
    'hides all writes without manage',
    async (value) => {
      state.allowed = false;
      mountActions(value);
      await nextTick();
      for (const label of [
        '归档',
        '恢复',
        '彻底删除',
        '停用',
        '启用',
        '编辑名称',
        '重发管理员邀请',
      ])
        expect(buttons(label)).toHaveLength(0);
    },
  );
  it('blocks writes while the list is disabled', async () => {
    const disabled = ref(true);
    app = createApp({
      render: () =>
        h(TenantActions, { tenant: archived, disabled: disabled.value }),
    });
    app.mount(root);
    for (const label of ['恢复', '彻底删除'])
      expect(firstButton(label).disabled).toBe(true);
    firstButton('恢复').click();
    expect(state.restore).not.toHaveBeenCalled();
    disabled.value = false;
    await nextTick();
    expect(firstButton('彻底删除').disabled).toBe(false);
  });
});
