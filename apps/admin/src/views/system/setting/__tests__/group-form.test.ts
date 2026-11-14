import type { SettingGroup } from '#/api/model/configuration';

import { createApp } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import GroupForm from '../group-form.vue';

const state = vi.hoisted(() => ({
  codes: ['system:setting:update'],
  update: vi.fn(),
}));
vi.mock('#/auth/permission', () => ({
  hasPermission: (code: string) => state.codes.includes(code),
}));
vi.mock('#/api/core/settings', () => ({ updateSettingGroupApi: state.update }));
vi.mock('#/api/core/system', () => ({ getAllRolesApi: vi.fn() }));
const group: SettingGroup = {
  group: 'system',
  items: [
    {
      schema: {
        group: 'system',
        key: 'system_name',
        type: 'string',
        default: 'Default',
        min: 1,
        max: 64,
        read_only: false,
        desc: '系统名称',
        hot_reload: false,
      },
      value: 'Old name',
    },
    {
      schema: {
        group: 'system',
        key: 'timezone',
        type: 'string',
        default: 'Asia/Shanghai',
        read_only: true,
        desc: '时区',
        hot_reload: false,
      },
      value: 'Asia/Shanghai',
    },
  ],
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  state.codes = ['system:setting:update'];
  state.update.mockReset();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app.unmount();
  root.remove();
  message.destroy();
});
function mount() {
  app = createApp(GroupForm, { group });
  app.mount(root);
}
describe('settings form contracts', () => {
  it('marks and disables a schema read-only field and omits it from an actual save', async () => {
    state.update.mockResolvedValue(group);
    mount();
    const readOnly = root.querySelector<HTMLInputElement>(
      '[aria-label="时区"]',
    );
    if (!readOnly) throw new Error('Missing read-only input');
    expect(readOnly.disabled).toBe(true);
    expect(
      root.querySelector('[data-setting-key="timezone"]')?.textContent,
    ).toContain('不可修改');
    const input = root.querySelector<HTMLInputElement>(
      '[aria-label="系统名称"]',
    );
    if (!input) throw new Error('Missing system name input');
    input.value = 'New name';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    const form = root.querySelector('form');
    if (!form) throw new Error('Missing settings form');
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    await vi.waitFor(() =>
      expect(state.update).toHaveBeenCalledWith('system', {
        system_name: 'New name',
      }),
    );
  });
  it('hides save and disables all inputs without update permission', () => {
    state.codes = [];
    mount();
    expect(root.textContent).not.toContain('保存配置');
    expect(
      [...root.querySelectorAll('input')].every((input) => input.disabled),
    ).toBe(true);
    const form = root.querySelector('form');
    if (!form) throw new Error('Missing settings form');
    form.dispatchEvent(
      new Event('submit', { bubbles: true, cancelable: true }),
    );
    expect(state.update).not.toHaveBeenCalled();
  });
});
