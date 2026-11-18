import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Verify from '../register-verify.vue';

const verify = vi.hoisted(() => vi.fn());
vi.mock('#/api/core/registration', () => ({ verifyRegistrationApi: verify }));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  verify.mockReset().mockResolvedValue(undefined);
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});
async function mount(suffix: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/auth/register/verify',
        name: 'RegisterVerify',
        component: Verify,
      },
      { path: '/auth/login', name: 'Login', component: Verify },
      { path: '/auth/register', name: 'Register', component: Verify },
    ],
  });
  await router.push(`/auth/register/verify${suffix}`);
  app = createApp(Verify);
  app.use(router).mount(root);
}
describe('email verification', () => {
  it.each(['?token=opaque', '#token=opaque'])(
    'verifies on mount with query or backend fragment credentials',
    async (suffix) => {
      await mount(suffix);
      await vi.waitFor(() =>
        expect(root.textContent).toContain('邮箱已验证，现在可以登录了'),
      );
      expect(verify).toHaveBeenCalledExactlyOnceWith('opaque');
      expect(root.querySelector('a')?.getAttribute('href')).toBe('/auth/login');
    },
  );
  it.each([
    '?token=invalid',
    '?tenant=acme&tenant_id=2#token=invalid',
    '?tenant=&tenant_id=invalid#token=invalid',
  ])('shows the recovery message for a rejected token: %s', async (suffix) => {
    verify.mockRejectedValue(new Error('private backend detail'));
    await mount(suffix);
    await vi.waitFor(() =>
      expect(root.textContent).toContain('链接已失效，请重新获取验证邮件'),
    );
    expect(root.textContent).not.toContain('private backend detail');
    expect(root.querySelector('a')?.textContent?.trim()).toBe('重新注册');
  });
  it.each([
    '',
    '?tenant=acme',
    '?tenant=&tenant_id=invalid',
    `#token=${'x'.repeat(129)}`,
  ])('fails locally with a missing or oversized token: %s', async (suffix) => {
    await mount(suffix);
    await vi.waitFor(() =>
      expect(root.textContent).toContain('链接已失效，请重新获取验证邮件'),
    );
    expect(verify).not.toHaveBeenCalled();
  });
});
