import type { TenantTemplate } from '#/api/model/tenant';

import { createApp, h, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import ProvisionWizard from '../provision-wizard.vue';

const state = vi.hoisted(() => ({ provision: vi.fn(), allowed: true }));
vi.mock('#/api/core/tenants', () => ({ provisionTenantApi: state.provision }));
vi.mock('#/auth/tenant', () => ({ canManageTenants: () => state.allowed }));
vi.mock('ant-design-vue', async (original) => {
  const actual = await original<typeof import('ant-design-vue')>();
  return {
    ...actual,
    Select: {
      props: ['value', 'options'],
      emits: ['update:value'],
      template:
        '<select :value="value" @change="$emit(\'update:value\', Number($event.target.value))"><option value="">请选择</option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    },
  };
});
const snapshot: TenantTemplate = {
  id: 3,
  code: 'standard',
  name: '标准模板',
  description: '',
  roles: [],
  menus: [],
  permissions: [],
  settings: {},
  created_at: '',
  updated_at: '',
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
const visible = ref(true);
const created = vi.fn();
function button(text: string) {
  const result = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((element) => element.textContent?.replaceAll(/\s/g, '') === text);
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
async function fill(label: string, value: string) {
  const element = document.querySelector<HTMLInputElement>(
    `[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing input: ${label}`);
  element.value = value;
  element.dispatchEvent(
    new Event(element.tagName === 'SELECT' ? 'change' : 'input', {
      bubbles: true,
    }),
  );
  await nextTick();
}
async function mount(templates = [snapshot]) {
  app = createApp({
    render: () =>
      visible.value
        ? h(ProvisionWizard, {
            templates,
            onClose: () => {
              visible.value = false;
            },
            onCreated: created,
          })
        : null,
  });
  app.mount(root);
  await nextTick();
}
async function ready() {
  await fill('租户 Code', 'acme');
  await fill('租户名称', 'Acme');
  button('下一步').click();
  await vi.waitFor(() =>
    expect(
      document.querySelector('[aria-label="管理员用户名"]'),
    ).not.toBeNull(),
  );
  await fill('租户模板', '3');
  await fill('管理员用户名', 'acme-admin');
}
beforeEach(() => {
  state.allowed = true;
  state.provision.mockReset();
  created.mockReset();
  visible.value = true;
  localStorage.clear();
  sessionStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});
describe('tenant provisioning and one-time invitation', () => {
  it('validates each step and retains basic fields when navigating back', async () => {
    await mount();
    button('下一步').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('Code 须以小写字母开头'),
    );
    expect(state.provision).not.toHaveBeenCalled();
    await ready();
    button('上一步').click();
    await nextTick();
    expect(
      (document.querySelector('[aria-label="租户 Code"]') as HTMLInputElement)
        .value,
    ).toBe('acme');
    expect(
      (document.querySelector('[aria-label="租户名称"]') as HTMLInputElement)
        .value,
    ).toBe('Acme');
  });
  it('blocks double submission, preserves backend errors and discards the link on close', async () => {
    await mount();
    await ready();
    state.provision.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 10_004,
        message: '租户 code 已存在',
        config: { preserveBusinessMessage: true } as never,
      }),
    );
    button('确认开通').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('租户 code 已存在'),
    );
    let finish!: (result: { tenant_id: number; invite_url: string }) => void;
    state.provision.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    button('确认开通').click();
    button('确认开通').click();
    await vi.waitFor(() => expect(state.provision).toHaveBeenCalledTimes(2));
    const credential = 'one-use-fixture';
    finish({
      tenant_id: 8,
      invite_url: `/auth/invite/accept?tenant_id=8#token=${credential}`,
    });
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('仅本次显示'),
    );
    expect(created).toHaveBeenCalledTimes(1);
    expect(state.provision).toHaveBeenLastCalledWith({
      code: 'acme',
      name: 'Acme',
      template_id: 3,
      admin_username: 'acme-admin',
    });
    const text = document.querySelector<HTMLTextAreaElement>(
      '[aria-label="账号链接"]',
    );
    expect(text?.value).toContain(credential);
    expect(
      JSON.stringify([
        Object.values(localStorage),
        Object.values(sessionStorage),
      ]),
    ).not.toContain(credential);
    document.querySelector<HTMLButtonElement>('.ant-modal-close')?.click();
    await vi.waitFor(() =>
      expect(document.querySelector('[aria-label="账号链接"]')).toBeNull(),
    );
    visible.value = true;
    await nextTick();
    expect(document.querySelector('[aria-label="账号链接"]')).toBeNull();
  });
  it('drops a late provision response after navigation and hides submit without manage', async () => {
    await mount();
    await ready();
    let finish!: (result: { tenant_id: number; invite_url: string }) => void;
    state.provision.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    button('确认开通').click();
    await vi.waitFor(() => expect(state.provision).toHaveBeenCalledOnce());
    visible.value = false;
    await nextTick();
    finish({
      tenant_id: 8,
      invite_url: '/auth/invite/accept?tenant_id=8#token=late-fixture',
    });
    await nextTick();
    expect(created).not.toHaveBeenCalled();
    expect(document.querySelector('[aria-label="账号链接"]')).toBeNull();
    state.allowed = false;
    visible.value = true;
    await nextTick();
    expect(
      [...document.querySelectorAll('button')].some((item) =>
        item.textContent?.includes('下一步'),
      ),
    ).toBe(false);
  });
  it('offers template creation and blocks provisioning when no templates exist', async () => {
    await mount([]);
    await fill('租户 Code', 'acme');
    await fill('租户名称', 'Acme');
    button('下一步').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('暂无租户模板'),
    );
    expect(button('确认开通').disabled).toBe(true);
    expect(button('生成模板')).toBeDefined();
  });
});
