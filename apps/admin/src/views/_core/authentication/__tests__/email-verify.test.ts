import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Verify from '../email-verify.vue';

const api = vi.hoisted(() => ({
  verify: vi.fn(),
  expire: vi.fn(),
  tenant: vi.fn(),
}));
vi.mock('#/api/core/self-service', () => ({ verifyMyEmailApi: api.verify }));
vi.mock('#/auth/login-tenant', () => ({ rememberTenantCode: api.tenant }));
vi.mock('#/store', () => ({
  useAuthStore: () => ({ expireSession: api.expire }),
}));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  api.verify.mockResolvedValue({ email: 'new@example.test' });
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
  vi.useRealTimers();
});
async function mount(suffix: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/auth/email/verify', name: 'EmailVerify', component: Verify },
      {
        path: '/auth/login',
        name: 'Login',
        component: { template: '<div>登录页面</div>' },
      },
      { path: '/profile', component: { template: '<div>个人资料</div>' } },
    ],
  });
  await router.push(`/auth/email/verify${suffix}`);
  app = createApp({
    template:
      '<RouterView v-slot="{ Component, route }"><component :is="Component" :key="route.fullPath" /></RouterView>',
  });
  app.use(router).mount(root);
  return router;
}
describe('profile email verification', () => {
  it('uses only the fragment credential, scrubs it, displays server email and redirects to tenant login', async () => {
    vi.useFakeTimers();
    const router = await mount('?tenant=acme#token=opaque');
    await vi.waitFor(() => expect(root.textContent).toContain('邮箱变更成功'));
    expect(api.verify).toHaveBeenCalledExactlyOnceWith('opaque');
    expect(root.textContent).toContain('new@example.test');
    expect(root.textContent).not.toContain('opaque');
    expect(router.options.history.location).toBe(
      '/auth/email/verify?tenant=acme',
    );
    await vi.advanceTimersByTimeAsync(3000);
    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe(
        '/auth/login?tenant=acme',
      ),
    );
    expect(api.expire).toHaveBeenCalledExactlyOnceWith(false);
    expect(api.tenant).toHaveBeenCalledExactlyOnceWith('acme');
  });
  it.each(['', '?token=opaque', `#token=${'x'.repeat(129)}`])(
    'rejects missing, query-only and oversized credentials locally: %s',
    async (suffix) => {
      const router = await mount(suffix);
      await vi.waitFor(() =>
        expect(root.textContent).toContain('链接已失效，请重新获取验证邮件'),
      );
      expect(api.verify).not.toHaveBeenCalled();
      expect(router.options.history.location).toBe('/auth/email/verify');
    },
  );
  it('shows a recovery path for an expired or reused token without backend details', async () => {
    api.verify.mockRejectedValue(new Error('private backend detail'));
    await mount('#token=invalid');
    await vi.waitFor(() =>
      expect(root.textContent).toContain('链接已失效，请重新获取验证邮件'),
    );
    expect(root.textContent).not.toContain('private backend detail');
    expect(root.textContent).toContain('返回个人资料重新发送');
    expect(api.expire).not.toHaveBeenCalled();
  });
  it('cancels the success redirect when leaving the page', async () => {
    vi.useFakeTimers();
    const router = await mount('#token=opaque');
    await vi.waitFor(() => expect(root.textContent).toContain('邮箱变更成功'));
    await router.push('/profile');
    await vi.advanceTimersByTimeAsync(5000);
    expect(router.currentRoute.value.path).toBe('/profile');
    expect(api.expire).not.toHaveBeenCalled();
  });
  it('does not render or redirect for a request that completes after unmount', async () => {
    let resolve!: (value: { email: string }) => void;
    api.verify.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const router = await mount('#token=opaque');
    await vi.waitFor(() => expect(api.verify).toHaveBeenCalledTimes(1));
    await router.push('/profile');
    resolve({ email: 'new@example.test' });
    await Promise.resolve();
    expect(router.currentRoute.value.path).toBe('/profile');
    expect(root.textContent).toBe('个人资料');
    expect(api.expire).not.toHaveBeenCalled();
  });
});
