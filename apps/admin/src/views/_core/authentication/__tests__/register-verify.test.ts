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
  it('maps invalid, expired or reused tokens to the same failed result', async () => {
    verify.mockRejectedValue(new Error('private backend detail'));
    await mount('?token=invalid');
    await vi.waitFor(() =>
      expect(root.textContent).toContain('链接无效或已过期'),
    );
    expect(root.textContent).not.toContain('private backend detail');
    expect(root.querySelector('a')?.textContent?.trim()).toBe('重新注册');
  });
  it('fails locally without a token', async () => {
    await mount('');
    await vi.waitFor(() =>
      expect(root.textContent).toContain('链接无效或已过期'),
    );
    expect(verify).not.toHaveBeenCalled();
  });
});
