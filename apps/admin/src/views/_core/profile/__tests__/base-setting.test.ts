import type { IdentityUser } from '#/api/model/identity';

import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import BaseSetting from '../base-setting.vue';

const state = vi.hoisted(() => ({ save: vi.fn(), success: vi.fn() }));
vi.mock('#/api/core/self-service', () => ({ updateMyProfileApi: state.save }));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: { success: state.success },
}));

let app: ReturnType<typeof createApp> | undefined;
let root: HTMLDivElement;
const profile: IdentityUser = {
  id: 9,
  username: 'operator',
  nickname: '原昵称',
  dept_id: 1,
  is_super: false,
  roles: [],
  tenant_id: 1,
};
afterEach(() => {
  app?.unmount();
  root?.remove();
  vi.clearAllMocks();
});
async function mount(value = profile) {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(BaseSetting, { profile: value });
  app.mount(root);
  await nextTick();
}
async function fill(label: string, value: string) {
  const input = [...root.querySelectorAll('input')].find(
    (element) => element.getAttribute('aria-label') === label,
  );
  if (!input) throw new Error('Profile field is missing');
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  input.dispatchEvent(new Event('change', { bubbles: true }));
  await nextTick();
}
async function submit() {
  const form = root.querySelector('form');
  if (!form) throw new Error('Profile form is missing');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await nextTick();
}
describe('personal profile update', () => {
  it('does not clear a server email that was omitted from /auth/me', async () => {
    await mount();
    await fill('昵称', '新昵称');
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenCalledExactlyOnceWith({
        nickname: '新昵称',
        avatar: '',
      }),
    );
    expect(
      root.querySelector<HTMLInputElement>('input[aria-label="手机"]')
        ?.disabled,
    ).toBe(true);
  });
  it('allows an explicit email change and explains the next login', async () => {
    await mount();
    await fill('邮箱', 'new@example.test');
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        nickname: '原昵称',
        avatar: '',
        email: 'new@example.test',
      }),
    );
    expect(state.success).toHaveBeenCalledWith(
      '基本信息已保存，下次登录可使用新邮箱',
    );
  });
  it('can explicitly clear an email provided by /auth/me', async () => {
    await mount({ ...profile, email: 'old@example.test' });
    await fill('邮箱', '');
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        nickname: '原昵称',
        avatar: '',
        email: '',
      }),
    );
  });
  it('rejects a non-web avatar URL before making a request', async () => {
    await mount();
    await fill('头像 URL', 'javascript:alert(1)');
    await submit();
    await vi.waitFor(() =>
      expect(root.textContent).toContain('头像须为 HTTP 或 HTTPS 地址'),
    );
    expect(state.save).not.toHaveBeenCalled();
  });
});
