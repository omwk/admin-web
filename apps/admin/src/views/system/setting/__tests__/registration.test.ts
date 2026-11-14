import type { SettingGroup } from '#/api/model/configuration';

import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GroupForm from '../group-form.vue';

const state = vi.hoisted(() => ({
  codes: ['system:setting:update'],
  roles: vi.fn(),
  update: vi.fn(),
}));
vi.mock('#/auth/permission', () => ({
  hasPermission: (code: string) => state.codes.includes(code),
}));
vi.mock('#/api/core/settings', () => ({ updateSettingGroupApi: state.update }));
vi.mock('#/api/core/system', () => ({ getAllRolesApi: state.roles }));

function tenantGroup(enabled = false): SettingGroup {
  return {
    group: 'tenant',
    items: [
      {
        schema: {
          group: 'tenant',
          key: 'allow_self_registration',
          type: 'boolean',
          default: false,
          read_only: false,
          desc: '允许自助注册',
          hot_reload: true,
        },
        value: enabled,
      },
      {
        schema: {
          group: 'tenant',
          key: 'default_role_code',
          type: 'string',
          default: '',
          read_only: false,
          desc: '默认角色',
          hot_reload: true,
        },
        value: '',
      },
      {
        schema: {
          group: 'tenant',
          key: 'registration_hourly_limit',
          type: 'number',
          default: 10,
          min: 1,
          max: 10_000,
          read_only: false,
          desc: '每小时上限',
          hot_reload: true,
        },
        value: 10,
      },
    ],
  };
}
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  state.codes = ['system:setting:update'];
  state.roles.mockReset().mockResolvedValue([
    { id: 2, code: 'reader', name: '只读用户', status: 'active' },
    { id: 3, code: 'disabled', name: '停用角色', status: 'disabled' },
  ]);
  state.update.mockReset().mockResolvedValue(tenantGroup(true));
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
  message.destroy();
});
function mount(group = tenantGroup()) {
  app = createApp(GroupForm, { group });
  app.mount(root);
}
describe('tenant registration settings', () => {
  it('disables dependent controls when closed and always displays all three risks', async () => {
    mount();
    await nextTick();
    expect(root.querySelector('.ant-select-disabled')).not.toBeNull();
    expect(
      root.querySelector<HTMLInputElement>('input[aria-label="每小时上限"]')
        ?.disabled,
    ).toBe(true);
    for (const risk of [
      '开启后，任何知道本企业代码的人都可以注册账号。',
      '新用户需要完成邮箱验证才能登录。',
      '非首位用户将获得「默认角色」的权限——请确认它不是高权限角色。',
    ])
      expect(root.textContent).toContain(risk);
    root.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    await nextTick();
    expect(root.querySelector('.ant-select-disabled')).toBeNull();
    expect(
      root.querySelector<HTMLInputElement>('input[aria-label="每小时上限"]')
        ?.disabled,
    ).toBe(false);
  });

  it('loads tenant roles, keeps the minimum permission option and saves with immediate effect', async () => {
    state.codes = ['system:tenant:manage'];
    const success = vi.spyOn(message, 'success');
    mount();
    await vi.waitFor(() => expect(state.roles).toHaveBeenCalledOnce());
    expect(root.textContent).toContain('无角色（最小权限）');
    root.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    await nextTick();
    root
      .querySelector('form')
      ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await vi.waitFor(() =>
      expect(state.update).toHaveBeenCalledWith('tenant', {
        allow_self_registration: true,
      }),
    );
    expect(success).toHaveBeenCalledWith('已生效');
  });
});
