import type { PropType } from 'vue';

import type { TenantTemplate } from '#/api/model/tenant';

import { createApp, defineComponent, h, nextTick, ref } from 'vue';

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
    Select: defineComponent({
      props: {
        value: { type: Number, default: undefined },
        options: {
          type: Array as PropType<Array<{ label: string; value: number }>>,
          required: true,
        },
      },
      emits: ['update:value'],
      setup(_props, { expose }) {
        const element = ref<HTMLSelectElement>();
        expose({ focus: () => element.value?.focus() });
        return { element };
      },
      template:
        '<select ref="element" :value="value" @change="$emit(\'update:value\', Number($event.target.value))"><option value="">请选择</option><option v-for="option in options" :key="option.value" :value="option.value">{{ option.label }}</option></select>',
    }),
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
const manageTemplates = vi.fn();
function button(text: string) {
  const result = [
    ...document.querySelectorAll<HTMLButtonElement>('button'),
  ].find((element) => element.textContent?.replaceAll(/\s/g, '') === text);
  if (!result) throw new Error(`Missing button: ${text}`);
  return result;
}
function input(label: string) {
  const element = document.querySelector<HTMLInputElement>(
    `[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing input: ${label}`);
  return element;
}
function field(label: string) {
  const element = input(label).closest('.ant-form-item');
  if (!element) throw new Error(`Missing field: ${label}`);
  return element;
}
async function blur(label: string) {
  input(label).focus();
  input(label).blur();
  await nextTick();
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
            onTemplates: manageTemplates,
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
  manageTemplates.mockReset();
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
  it('leaves empty fields quiet on blur and focuses the first required error on submit', async () => {
    await mount();
    await blur('租户 Code');
    await blur('租户名称');
    expect(document.querySelector('.ant-form-item-has-error')).toBeNull();
    button('下一步').click();
    await vi.waitFor(() => {
      expect(
        field('租户 Code').classList.contains('ant-form-item-has-error'),
      ).toBe(true);
      expect(field('租户名称').textContent).toContain('名称须为 1–128 字符');
      expect(document.activeElement).toBe(input('租户 Code'));
    });
    expect(document.querySelector('.ant-alert-error')).toBeNull();
    expect(state.provision).not.toHaveBeenCalled();
    await fill('租户 Code', 'ACME');
    expect(
      field('租户 Code').classList.contains('ant-form-item-has-error'),
    ).toBe(true);
    await fill('租户 Code', 'acme');
    await vi.waitFor(() =>
      expect(
        field('租户 Code').classList.contains('ant-form-item-has-error'),
      ).toBe(false),
    );
    button('下一步').click();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(input('租户名称')),
    );
  });
  it('validates nonempty basic fields on blur and clears only corrected errors', async () => {
    await mount();
    await fill('租户 Code', '47Invalid');
    expect(
      field('租户 Code').classList.contains('ant-form-item-has-error'),
    ).toBe(false);
    await blur('租户 Code');
    expect(field('租户 Code').textContent).toContain('Code 须以小写字母开头');
    expect(
      input('租户 Code').classList.contains('ant-input-status-error'),
    ).toBe(true);
    await fill('租户名称', '名'.repeat(129));
    await blur('租户名称');
    expect(field('租户名称').textContent).toContain('名称须为 1–128 字符');
    await fill('租户名称', 'Acme');
    await vi.waitFor(() =>
      expect(
        field('租户名称').classList.contains('ant-form-item-has-error'),
      ).toBe(false),
    );
    expect(
      field('租户 Code').classList.contains('ant-form-item-has-error'),
    ).toBe(true);
    expect(document.querySelector('.ant-alert-error')).toBeNull();
  });
  it('shows email errors beneath the input on blur and revalidates immediately while editing', async () => {
    await mount();
    await ready();
    expect(input('管理员邮箱').placeholder).toBe('例如 ops@acme.com');
    expect(field('管理员邮箱').textContent).toContain('留空也可以');
    await blur('管理员邮箱');
    expect(
      field('管理员邮箱').classList.contains('ant-form-item-has-error'),
    ).toBe(false);
    await fill('管理员邮箱', '47wmdyhhd');
    await blur('管理员邮箱');
    expect(
      field('管理员邮箱').querySelector('.ant-form-item-explain-error')
        ?.textContent,
    ).toContain('请填写有效的管理员邮箱');
    expect(
      input('管理员邮箱').classList.contains('ant-input-status-error'),
    ).toBe(true);
    expect(document.querySelector('.ant-alert-error')).toBeNull();
    await fill('管理员邮箱', 'still-invalid');
    expect(
      field('管理员邮箱').classList.contains('ant-form-item-has-error'),
    ).toBe(true);
    await fill('管理员邮箱', 'ops@acme.com');
    await vi.waitFor(() =>
      expect(
        field('管理员邮箱').classList.contains('ant-form-item-has-error'),
      ).toBe(false),
    );
    await fill('管理员邮箱', 'invalid');
    await blur('管理员邮箱');
    await fill('管理员邮箱', '');
    await vi.waitFor(() =>
      expect(
        field('管理员邮箱').classList.contains('ant-form-item-has-error'),
      ).toBe(false),
    );
    expect(state.provision).not.toHaveBeenCalled();
  });
  it('validates all administrator fields on submit and focuses username before email', async () => {
    await mount();
    await ready();
    await fill('管理员用户名', '');
    await blur('管理员用户名');
    expect(
      field('管理员用户名').classList.contains('ant-form-item-has-error'),
    ).toBe(false);
    await fill('管理员邮箱', '47wmdyhhd');
    button('确认开通').click();
    await vi.waitFor(() => {
      expect(field('管理员用户名').textContent).toContain(
        '管理员用户名须为 1–256 字符',
      );
      expect(
        field('管理员邮箱').classList.contains('ant-form-item-has-error'),
      ).toBe(true);
      expect(document.activeElement).toBe(input('管理员用户名'));
    });
    await fill('管理员用户名', 'a'.repeat(257));
    expect(
      field('管理员用户名').classList.contains('ant-form-item-has-error'),
    ).toBe(true);
    await fill('管理员用户名', 'admin');
    button('确认开通').click();
    await vi.waitFor(() =>
      expect(document.activeElement).toBe(input('管理员邮箱')),
    );
    expect(document.querySelector('.ant-alert-error')).toBeNull();
    expect(state.provision).not.toHaveBeenCalled();
  });
  it('keeps missing template errors at the selector instead of the server banner', async () => {
    await mount();
    await ready();
    await fill('租户模板', '');
    button('确认开通').click();
    await vi.waitFor(() =>
      expect(field('租户模板').textContent).toContain('请选择租户模板'),
    );
    expect(document.activeElement).toBe(input('租户模板'));
    expect(document.querySelector('.ant-alert-error')).toBeNull();
    expect(state.provision).not.toHaveBeenCalled();
    await fill('租户模板', '3');
    await vi.waitFor(() =>
      expect(
        field('租户模板').classList.contains('ant-form-item-has-error'),
      ).toBe(false),
    );
  });
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
      expect(document.body.textContent).toContain('还没有可用的租户模板'),
    );
    expect(button('确认开通').disabled).toBe(true);
    expect(document.querySelector('[aria-label="租户模板"]')).toBeNull();
    button('去创建模板').click();
    expect(manageTemplates).toHaveBeenCalledOnce();
  });
  it('warns for a zero-role template while still allowing provisioning', async () => {
    state.provision.mockResolvedValue({
      tenant_id: 8,
      invite_url: '/auth/invite/accept?tenant_id=8',
    });
    await mount();
    await ready();
    expect(document.querySelector('.ant-alert-warning')?.textContent).toContain(
      '该模板不含角色，开通后除管理员外没有其他角色可用。',
    );
    expect(button('确认开通').disabled).toBe(false);
    button('确认开通').click();
    await vi.waitFor(() => expect(state.provision).toHaveBeenCalledOnce());
  });
});
