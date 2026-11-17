import type { TenantTemplate } from '#/api/model/tenant';

import { createApp, defineComponent, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import TemplateEditor from '../template-editor.vue';

const state = vi.hoisted(() => ({
  allowed: true,
  detail: vi.fn(),
  permissions: vi.fn(),
  update: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
  Fallback: { template: '<p>403</p>' },
}));
vi.mock('#/auth/tenant', () => ({ canManageTenants: () => state.allowed }));
vi.mock('#/api/core/tenants', () => ({
  getTenantTemplateApi: state.detail,
  updateTenantTemplateApi: state.update,
}));
vi.mock('#/api/core/system', () => ({ getPermissionsApi: state.permissions }));
vi.mock('ant-design-vue', async (original) => {
  const actual = await original<typeof import('ant-design-vue')>();
  return {
    ...actual,
    Select: defineComponent({
      props: {
        value: { type: String, default: '' },
        options: { type: Array, default: () => [] },
        disabled: Boolean,
      },
      emits: ['update:value'],
      template:
        '<select :value="value" :disabled="disabled" @change="$emit(\'update:value\', $event.target.value)"><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    }),
  };
});

const snapshot: TenantTemplate = {
  id: 9,
  code: 'readonly',
  name: '只读版',
  description: '模板说明',
  roles: [
    {
      code: 'reader',
      name: '只读',
      data_scope: 'self',
      status: 'disabled',
      remark: '保留备注',
      permissions: ['catalog:product:list'],
      menus: ['menu:legacy'],
    },
  ],
  menus: [
    {
      key: 'menu:legacy',
      parent_key: '',
      name: '商品列表',
      path: null,
      type: 'menu',
      permission_code: null,
    },
  ],
  permissions: [],
  settings: {},
  created_at: '',
  updated_at: '',
};
const groups = {
  catalog: [
    {
      id: 1,
      code: 'catalog:product:list',
      module: 'catalog',
      name: '商品列表',
      type: 'api',
    },
    {
      id: 2,
      code: 'catalog:product:create',
      module: 'catalog',
      name: '新增商品',
      type: 'api',
    },
  ],
};
let app: ReturnType<typeof createApp>;
let router: ReturnType<typeof createRouter>;
let root: HTMLDivElement;
function button(text: string, scope: ParentNode = document) {
  const result = [...scope.querySelectorAll<HTMLButtonElement>('button')].find(
    (node) => node.textContent?.replaceAll(/\s/g, '') === text,
  );
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function confirmation() {
  const element = [...document.querySelectorAll('.ant-modal-confirm')].at(-1);
  if (!element) throw new Error('Missing confirmation');
  return element;
}
function input(label: string) {
  const element = document.querySelector<HTMLInputElement>(
    `[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing input: ${label}`);
  return element;
}
async function fill(label: string, value: string) {
  const element = input(label);
  element.value = value;
  element.dispatchEvent(
    new Event(element.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true,
    }),
  );
  await nextTick();
}
async function mount() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/system/tenants/templates/:id', component: TemplateEditor },
      {
        path: '/system/tenants/templates',
        component: { template: '<p>模板列表</p>' },
      },
    ],
  });
  await router.push('/system/tenants/templates/9');
  app = createApp({ render: () => h(RouterView) });
  app.use(router);
  app.mount(root);
  await router.isReady();
  if (state.allowed)
    await vi.waitFor(() => {
      if (!document.querySelector('[aria-label="模板名称"]'))
        throw new Error('Editor not loaded');
    });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.allowed = true;
  state.detail.mockResolvedValue(snapshot);
  state.permissions.mockResolvedValue(groups);
  state.update.mockImplementation(async (_id, payload) => ({
    ...snapshot,
    ...payload,
  }));
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(async () => {
  app?.unmount();
  Modal.destroyAll();
  message.destroy();
  await nextTick();
  root.remove();
});

describe('tenant template editor', () => {
  it('fills saved roles, disables codes and menu editing, and replaces complete roles with the required name', async () => {
    await mount();
    expect(input('角色名').value).toBe('只读');
    expect(input('角色 Code').disabled).toBe(true);
    expect(input('模板 Code').disabled).toBe(true);
    expect(input('数据范围').value).toBe('self');
    expect(
      document.querySelectorAll(
        '[data-testid="template-readonly-menus"] .ant-tree-checkbox-disabled',
      ),
    ).toHaveLength(1);
    expect(button('保存模板').disabled).toBe(true);
    await fill('角色名', '商品只读');
    await fill('数据范围', 'dept_and_child');
    await fill('搜索权限码', 'create');
    await nextTick();
    input('catalog:product:create').click();
    await nextTick();
    button('保存模板').click();
    await vi.waitFor(() => expect(state.update).toHaveBeenCalledOnce());
    expect(state.update).toHaveBeenCalledWith(9, {
      name: '只读版',
      description: '模板说明',
      roles: [
        {
          ...snapshot.roles[0],
          name: '商品只读',
          data_scope: 'dept_and_child',
          permissions: ['catalog:product:list', 'catalog:product:create'],
        },
      ],
    });
    await vi.waitFor(() => expect(button('保存模板').disabled).toBe(true));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
  });
  it('blocks empty role names and duplicate codes while allowing roles to be added and deleted', async () => {
    await mount();
    await fill('角色名', ' ');
    button('保存模板').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('角色名须为'),
    );
    expect(state.update).not.toHaveBeenCalled();
    await fill('角色名', '只读');
    button('添加角色').click();
    await nextTick();
    await fill('新角色 Code', 'reader');
    await fill('新角色名', '审计');
    button('添加').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('角色 Code「reader」重复'),
    );
    await fill('新角色 Code', 'auditor');
    button('添加').click();
    await vi.waitFor(() => expect(input('角色 Code').value).toBe('auditor'));
    expect(input('角色 Code').disabled).toBe(true);
    expect(
      root.querySelector('[data-testid="template-role-list"]')?.textContent,
    ).toContain('auditor');
    button('删除角色').click();
    await vi.waitFor(() =>
      expect(document.querySelector('.ant-modal-confirm')).not.toBeNull(),
    );
    button('删除角色', confirmation()).click();
    await vi.waitFor(() => expect(input('角色 Code').value).toBe('reader'));
    expect(
      root.querySelector('[data-testid="template-role-list"]')?.textContent,
    ).not.toContain('auditor');
  });
  it('asks before saving an empty permission set and permits explicit confirmation', async () => {
    await mount();
    await fill('搜索权限码', 'list');
    input('catalog:product:list').click();
    await nextTick();
    button('保存模板').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('部分角色未配置权限'),
    );
    expect(state.update).not.toHaveBeenCalled();
    button('取消', confirmation()).click();
    await vi.waitFor(() => expect(button('保存模板').disabled).toBe(false));
    button('保存模板').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('仍然保存'),
    );
    button('仍然保存', confirmation()).click();
    await vi.waitFor(() =>
      expect(state.update).toHaveBeenCalledWith(
        9,
        expect.objectContaining({
          name: '只读版',
          roles: [
            expect.objectContaining({
              permissions: [],
              menus: ['menu:legacy'],
            }),
          ],
        }),
      ),
    );
  });
  it('retains the draft and backend message after a failed save and permits retry', async () => {
    state.update.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 10_004,
        message: '模板保存冲突，原始文案。',
        config: { preserveBusinessMessage: true } as never,
      }),
    );
    await mount();
    await fill('角色名', '保留草稿');
    button('保存模板').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('模板保存冲突，原始文案。'),
    );
    expect(input('角色名').value).toBe('保留草稿');
    button('保存模板').click();
    await vi.waitFor(() => expect(state.update).toHaveBeenCalledTimes(2));
    await vi.waitFor(() => expect(button('保存模板').disabled).toBe(true));
  });
  it('protects browser refresh, route leave and same-component ID changes without discarding a cancelled draft', async () => {
    await mount();
    await fill('模板名称', '未保存草稿');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    let navigation = router.push('/system/tenants/templates/10');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('模板有未保存的修改'),
    );
    button('取消', confirmation()).click();
    await navigation;
    expect(router.currentRoute.value.params.id).toBe('9');
    expect(input('模板名称').value).toBe('未保存草稿');
    expect(state.detail).not.toHaveBeenCalledWith(10);
    navigation = router.push('/system/tenants/templates');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('放弃修改并离开'),
    );
    button('放弃修改并离开', confirmation()).click();
    await navigation;
    expect(router.currentRoute.value.path).toBe('/system/tenants/templates');
    const cleanUnload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(cleanUnload);
    expect(cleanUnload.defaultPrevented).toBe(false);
  });
  it('hides editing and requests no data without tenant manage permission', async () => {
    state.allowed = false;
    await mount();
    expect(
      document.querySelector('[data-testid="template-editor"]'),
    ).toBeNull();
    expect(state.detail).not.toHaveBeenCalled();
    expect(state.permissions).not.toHaveBeenCalled();
    expect(state.update).not.toHaveBeenCalled();
  });
});
