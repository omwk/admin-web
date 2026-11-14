import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import PasswordSetting from '../password-setting.vue';

const state = vi.hoisted(() => ({ change: vi.fn(), success: vi.fn() }));
vi.mock('#/api/core/self-service', () => ({
  changeMyPasswordApi: state.change,
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: { success: state.success },
}));

let app: ReturnType<typeof createApp> | undefined;
let root: HTMLDivElement;
afterEach(() => {
  app?.unmount();
  root?.remove();
  vi.clearAllMocks();
});

async function submit(next: string, confirmation = next) {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(PasswordSetting);
  app.mount(root);
  await nextTick();
  const fields: [string, string][] = [
    ['旧密码', 'OldPass123'],
    ['新密码', next],
    ['确认新密码', confirmation],
  ];
  for (const [label, value] of fields) {
    const input = root.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    );
    expect(input).not.toBeNull();
    if (!input) throw new Error('Password field is missing');
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await nextTick();
  const form = root.querySelector('form');
  if (!form) throw new Error('Password form is missing');
  form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  await nextTick();
}

describe('personal password change', () => {
  it.each(['Abc1234', 'abcdefgh', '12345678'])(
    'blocks weak password %s before transport',
    async (password) => {
      await submit(password);
      await vi.waitFor(() =>
        expect(root.textContent).toContain('密码至少 8 个字符'),
      );
      expect(state.change).not.toHaveBeenCalled();
    },
  );

  it('blocks mismatched confirmation before transport', async () => {
    await submit('NextPass123', 'OtherPass123');
    await vi.waitFor(() =>
      expect(root.textContent).toContain('两次输入的密码不一致'),
    );
    expect(state.change).not.toHaveBeenCalled();
  });

  it('sends two passwords, clears the form and explains session revocation', async () => {
    state.change.mockResolvedValueOnce(undefined);
    await submit('NextPass123');
    await vi.waitFor(() =>
      expect(state.change).toHaveBeenCalledWith({
        oldPassword: 'OldPass123',
        newPassword: 'NextPass123',
      }),
    );
    await vi.waitFor(() =>
      expect(state.success).toHaveBeenCalledWith(
        '密码修改成功，其他设备的登录已失效',
      ),
    );
    expect(
      [...root.querySelectorAll<HTMLInputElement>('input')].every(
        (input) => input.value === '',
      ),
    ).toBe(true);
  });

  it('renders the backend error verbatim and keeps values for correction', async () => {
    state.change.mockRejectedValueOnce({
      businessMessage: '该密码近期已使用',
      status: 400,
    });
    await submit('NextPass123');
    await vi.waitFor(() =>
      expect(root.textContent).toContain('该密码近期已使用'),
    );
    expect(
      root.querySelector<HTMLInputElement>('input[aria-label="旧密码"]')?.value,
    ).toBe('OldPass123');
  });
});
