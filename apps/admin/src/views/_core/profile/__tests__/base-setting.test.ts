import type { IdentityUser } from '#/api/model/identity';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import BaseSetting from '../base-setting.vue';

const state = vi.hoisted(() => ({
  save: vi.fn(),
  change: vi.fn(),
  success: vi.fn(),
  saved: vi.fn(),
  upload: vi.fn(),
}));
vi.mock('#/api/core/self-service', () => ({
  updateMyProfileApi: state.save,
  changeMyEmailApi: state.change,
  uploadMyAvatarApi: state.upload,
}));
vi.mock('@vben/hooks', () => ({ useAppConfig: () => ({ apiURL: '/api' }) }));
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
const phone = () => `+${10 ** 10 + Math.floor(Math.random() * 10 ** 9)}`;
beforeEach(() => {
  vi.resetAllMocks();
  state.save.mockImplementation(async (input) => ({ ...profile, ...input }));
  state.change.mockResolvedValue({ pending: true, expires_in_hours: 24 });
});
afterEach(() => {
  app?.unmount();
  root?.remove();
});
async function mount(value = profile) {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(BaseSetting, { profile: value, onSaved: state.saved });
  app.mount(root);
  await nextTick();
}
function input(label: string) {
  const element = root.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!element) throw new Error('Profile field is missing');
  return element;
}
async function fill(label: string, value: string) {
  const element = input(label);
  element.value = value;
  element.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
}
async function submit() {
  root
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await nextTick();
  await vi.waitFor(() =>
    expect(
      root
        .querySelector('button[type="submit"]')
        ?.classList.contains('ant-btn-loading'),
    ).toBe(false),
  );
}
function conflict(message: string) {
  return new ApiError({
    status: 409,
    message,
    config: { preserveBusinessMessage: true } as never,
  });
}
describe('personal profile update', () => {
  it('does not erase omitted contacts and keeps phone editable', async () => {
    await mount();
    expect(input('手机').disabled).toBe(false);
    await fill('昵称', '新昵称');
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenCalledExactlyOnceWith({
        nickname: '新昵称',
        avatar: '',
      }),
    );
    expect(state.change).not.toHaveBeenCalled();
    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: '新昵称' }),
    );
  });
  it('sends a normalized changed email only to the verification request', async () => {
    await mount({ ...profile, email: 'old@example.test' });
    await fill('邮箱', ' NEW@example.test ');
    await submit();
    await vi.waitFor(() =>
      expect(state.change).toHaveBeenCalledExactlyOnceWith('new@example.test'),
    );
    expect(state.save).toHaveBeenCalledWith({ nickname: '原昵称', avatar: '' });
    expect(state.saved.mock.calls[0]?.[0]).not.toHaveProperty('email');
    expect(root.textContent).toContain('验证邮件已发送到新邮箱，24 小时内有效');
    await submit();
    expect(state.change).toHaveBeenCalledTimes(1);
  });
  it('does not request verification for an unchanged email regardless of case', async () => {
    await mount({ ...profile, email: 'old@example.test' });
    await fill('邮箱', 'OLD@example.test');
    await submit();
    await vi.waitFor(() => expect(state.save).toHaveBeenCalledTimes(1));
    expect(state.change).not.toHaveBeenCalled();
  });
  it.each(['', 'invalid'])(
    'rejects an invalid changed email at the email field: %s',
    async (value) => {
      await mount({ ...profile, email: 'old@example.test' });
      await fill('邮箱', value);
      await submit();
      await vi.waitFor(() =>
        expect(input('邮箱').getAttribute('aria-invalid')).toBe('true'),
      );
      expect(root.textContent).toContain('请输入有效的邮箱地址');
      expect(state.save).not.toHaveBeenCalled();
    },
  );
  it('saves trimmed E.164 phone and can explicitly clear a known phone', async () => {
    const value = phone();
    await mount({ ...profile, phone: value });
    await fill('手机', ` ${value} `);
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenCalledWith({
        nickname: '原昵称',
        avatar: '',
        phone: value,
      }),
    );
    await fill('手机', '');
    await submit();
    await vi.waitFor(() =>
      expect(state.save).toHaveBeenLastCalledWith({
        nickname: '原昵称',
        avatar: '',
        phone: '',
      }),
    );
    expect(state.success).toHaveBeenCalledWith(
      '手机号已更新，仅用于联系，不用于短信通知',
    );
  });
  it('preserves the submitted phone when the profile response omits it', async () => {
    const value = phone();
    state.save.mockResolvedValue({ ...profile, nickname: '已保存' });
    await mount();
    await fill('手机', value);
    await submit();
    await vi.waitFor(() =>
      expect(state.saved).toHaveBeenCalledWith({
        nickname: '已保存',
        avatar: undefined,
        phone: value,
      }),
    );
  });
  it.each(['123', '+0123', '+', '+1 234', `+${'1'.repeat(16)}`])(
    'rejects a malformed phone before either write: %s',
    async (value) => {
      await mount();
      await fill('手机', value);
      await submit();
      await vi.waitFor(() =>
        expect(input('手机').getAttribute('aria-invalid')).toBe('true'),
      );
      expect(root.textContent).toContain('E.164');
      expect(state.save).not.toHaveBeenCalled();
      expect(state.change).not.toHaveBeenCalled();
    },
  );
  it('shows the exact backend conflict at the phone field and preserves the input', async () => {
    const value = phone();
    state.save.mockRejectedValue(conflict('该手机号已被使用'));
    await mount();
    await fill('手机', value);
    await submit();
    await vi.waitFor(() =>
      expect(root.textContent).toContain('该手机号已被使用'),
    );
    expect(input('手机').getAttribute('aria-invalid')).toBe('true');
    expect(input('手机').value).toBe(value);
    expect(state.saved).not.toHaveBeenCalled();
  });
  it('emits saved profile before a later email conflict and attaches that conflict to email', async () => {
    state.change.mockRejectedValue(conflict('该邮箱已被使用'));
    await mount();
    await fill('昵称', '已保存昵称');
    await fill('邮箱', 'used@example.test');
    await submit();
    await vi.waitFor(() =>
      expect(root.textContent).toContain('该邮箱已被使用'),
    );
    expect(state.saved).toHaveBeenCalledWith(
      expect.objectContaining({ nickname: '已保存昵称' }),
    );
    expect(input('邮箱').getAttribute('aria-invalid')).toBe('true');
    expect(root.textContent).not.toContain(
      '验证邮件已发送到新邮箱，24 小时内有效',
    );
  });
  it('shows an existing avatar only through the round backend proxy and preserves the canonical value', async () => {
    const url = '/api/v1/avatars/9';
    await mount({ ...profile, avatar: url });
    expect(
      root.querySelector('.ant-avatar-circle img')?.getAttribute('src'),
    ).toMatch(/^\/api\/v1\/avatars\/9\?v=\d+$/);
    await submit();
    await vi.waitFor(() =>
      expect(state.saved).toHaveBeenCalledWith(
        expect.objectContaining({ avatar: url }),
      ),
    );
  });
  it('never loads a stored external URL directly or exposes a URL editor', async () => {
    await mount({
      ...profile,
      avatar: 'https://bucket.example.test/private.png',
    });
    expect(root.querySelector('.ant-avatar img')?.getAttribute('src')).toMatch(
      /^\/api\/v1\/avatars\/9\?/,
    );
    expect(root.querySelector('input[aria-label="头像 URL"]')).toBeNull();
  });
});
