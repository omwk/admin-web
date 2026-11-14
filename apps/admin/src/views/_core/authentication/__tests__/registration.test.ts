import { createApp, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';
import { REGISTRATION_ACCEPTED_MESSAGE } from '#/auth/registration';

import Register from '../register.vue';

const register = vi.hoisted(() => vi.fn());
vi.mock('#/api/core/registration', () => ({ registerApi: register }));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  register.mockReset().mockResolvedValue({ accepted: true });
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});
async function mount(query = '?tenant=acme') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/register', name: 'Register', component: Register },
      {
        path: '/auth/login',
        name: 'Login',
        component: { template: '<div />' },
      },
    ],
  });
  await router.push(`/auth/register${query}`);
  app = createApp(Register);
  app.use(router).mount(root);
  await nextTick();
}
async function fill(overrides: Record<string, string> = {}) {
  const values = {
    账号: 'alice',
    邮箱: 'alice@example.test',
    密码: 'Password123',
    确认密码: 'Password123',
    ...overrides,
  };
  for (const [label, value] of Object.entries(values)) {
    const input = root.querySelector<HTMLInputElement>(
      `input[aria-label="${label}"]`,
    );
    if (!input) throw new Error(`Missing registration field: ${label}`);
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await nextTick();
}
function submit() {
  root
    .querySelector('form')
    ?.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

describe('public registration', () => {
  it.each([
    { accepted: true },
    { accepted: true, dev_verify_url: 'development-only-link' },
  ])(
    'shows one accepted result regardless of response extras',
    async (data) => {
      register.mockResolvedValue(data);
      await mount();
      expect(
        root.querySelector<HTMLInputElement>('[aria-label="企业代码"]')
          ?.readOnly,
      ).toBe(true);
      await fill();
      submit();
      await vi.waitFor(() =>
        expect(root.textContent).toContain(REGISTRATION_ACCEPTED_MESSAGE),
      );
      expect(root.textContent).not.toContain('已存在');
      expect(root.textContent).not.toContain('development-only-link');
      expect(register).toHaveBeenCalledWith({
        tenant: 'acme',
        account: 'alice',
        email: 'alice@example.test',
        password: 'Password123',
      });
      expect(root.querySelector('input[type="password"]')).toBeNull();
    },
  );

  it.each(['Abc1234', 'abcdefgh', '12345678'])(
    'blocks weak password %s before any request',
    async (password) => {
      await mount();
      await fill({ 密码: password, 确认密码: password });
      submit();
      await vi.waitFor(() =>
        expect(root.textContent).toContain('密码至少 8 个字符'),
      );
      expect(register).not.toHaveBeenCalled();
    },
  );

  it.each([
    [{ 邮箱: 'invalid' }, '请输入有效的邮箱地址'],
    [{ 确认密码: 'Other123' }, '两次密码输入不一致'],
    [{ 账号: ' ' }, '请输入账号'],
  ] as const)(
    'validates the other required fields before posting',
    async (values, text) => {
      await mount();
      await fill(values);
      submit();
      await vi.waitFor(() => expect(root.textContent).toContain(text));
      expect(register).not.toHaveBeenCalled();
    },
  );

  it.each([
    [403, 20_111, '该企业未开放自助注册'],
    [429, 10_005, '注册过于频繁，请稍后再试'],
    [401, 20_101, '企业代码、账号或密码错误'],
    [400, 10_001, '租户密码策略要求至少 12 位'],
  ])(
    'displays the %s branch without a global session action',
    async (status, code, text) => {
      register.mockRejectedValue(
        new ApiError({
          status,
          code,
          message: text,
          config: { preserveBusinessMessage: true },
        } as ConstructorParameters<typeof ApiError>[0]),
      );
      await mount();
      await fill();
      submit();
      await vi.waitFor(() =>
        expect(root.querySelector('[role="alert"]')?.textContent).toContain(
          text,
        ),
      );
      expect(root.querySelector('form')).not.toBeNull();
    },
  );

  it('allows a manual tenant and prevents double submission while pending', async () => {
    register.mockImplementation(() => new Promise(() => {}));
    await mount('');
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="企业代码"]')?.readOnly,
    ).toBe(false);
    await fill({ 企业代码: ' manual ' });
    submit();
    submit();
    await vi.waitFor(() => expect(register).toHaveBeenCalledOnce());
    expect(register.mock.calls[0]?.[0].tenant).toBe('manual');
    expect(
      root.querySelector<HTMLInputElement>('[aria-label="企业代码"]')?.disabled,
    ).toBe(true);
  });
});
