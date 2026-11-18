import type { VNode } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import { cloneVNode, createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import AccountLink from '../account-link.vue';

const { accept, reset } = vi.hoisted(() => ({
  accept: vi.fn(),
  reset: vi.fn(),
}));
vi.mock('#/api/core/invites', () => ({
  consumeResetLinkApi: reset,
  acceptInviteApi: accept,
}));

let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
beforeEach(() => {
  accept.mockReset().mockResolvedValue(undefined);
  reset.mockReset().mockResolvedValue(undefined);
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  app?.unmount();
  container.remove();
});

async function mount(mode: 'invite' | 'reset', suffix: string) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      {
        path: '/auth/invite/accept',
        component: AccountLink,
        props: { mode: 'invite' },
      },
      {
        path: '/auth/password/reset',
        component: AccountLink,
        props: { mode: 'reset' },
      },
      {
        path: '/auth/account-complete',
        name: 'AccountLinkComplete',
        component: AccountLink,
        props: (route) => ({ mode: route.query.mode, complete: true }),
      },
      { path: '/auth/login', component: { render: () => null } },
    ],
  });
  await router.push(
    `/auth/${mode === 'invite' ? 'invite/accept' : 'password/reset'}${suffix}`,
  );
  app = createApp({
    render: () =>
      h(RouterView, null, {
        default: ({
          Component,
          route,
        }: {
          Component?: VNode;
          route: RouteLocationNormalizedLoaded;
        }) =>
          Component ? cloneVNode(Component, { key: route.fullPath }) : null,
      }),
  });
  app.use(router).mount(container);
  await nextTick();
  return router;
}

function input(label: string) {
  const element = container.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!element) throw new Error(`Missing field: ${label}`);
  return element;
}

async function submit(mode: 'invite' | 'reset') {
  for (const [label, value] of Object.entries({
    ...(mode === 'invite' ? { 用户名: 'invited-user' } : {}),
    新密码: 'Apassword123',
    确认密码: 'Apassword123',
  })) {
    const element = input(label);
    element.value = value;
    element.dispatchEvent(new Event('input', { bubbles: true }));
  }
  await nextTick();
  const button = container.querySelector<HTMLButtonElement>(
    'button[type="submit"]',
  );
  if (!button) throw new Error('Missing submit button');
  button.click();
}

describe.each(['invite', 'reset'] as const)(
  'public %s account link',
  (mode) => {
    it.each([
      '?tenant=acme#token=x',
      '?tenant=%20acme%20#token=x',
      '?tenant=acme&tenant_id=invalid#token=x',
      '?tenant_id=2#token=x',
      '?tenant=%20&tenant_id=2#token=x',
    ])('opens a valid code or legacy ID link: %s', async (suffix) => {
      await mount(mode, suffix);
      expect(container.textContent).not.toContain('链接不完整');
      expect(input('新密码').disabled).toBe(false);
      expect(
        container.querySelector<HTMLButtonElement>('button[type="submit"]')
          ?.disabled,
      ).toBe(false);
    });

    it.each([
      '#token=x',
      '?tenant=%20#token=x',
      '?tenant_id=0#token=x',
      '?tenant_id=-1#token=x',
      '?tenant_id=1.5#token=x',
      '?tenant_id=9007199254740992#token=x',
      '?tenant_id=invalid#token=x',
      '?tenant=acme&tenant=other#token=x',
      '?tenant_id=2&tenant_id=3#token=x',
      '?tenant=acme',
    ])(
      'blocks an incomplete or invalid link without an API call: %s',
      async (suffix) => {
        await mount(mode, suffix);
        expect(container.textContent).toContain('链接不完整');
        expect(input('新密码').disabled).toBe(true);
        const button = container.querySelector<HTMLButtonElement>(
          'button[type="submit"]',
        );
        expect(button?.disabled).toBe(true);
        button?.click();
        expect(accept).not.toHaveBeenCalled();
        expect(reset).not.toHaveBeenCalled();
      },
    );

    it.each([
      { query: 'tenant=acme', code: 'acme' },
      { query: 'tenant=%20acme%20&tenant_id=2', code: 'acme' },
      { query: 'tenant=acme&tenant_id=invalid', code: 'acme' },
      { query: 'tenant_id=2', code: '' },
      { query: 'tenant=%20&tenant_id=2', code: '' },
    ])(
      'retains completion and login tenant after credential removal: $query',
      async ({ query, code }) => {
        const router = await mount(mode, `?${query}#token=opaque`);
        await submit(mode);
        await vi.waitFor(() =>
          expect(
            mode === 'invite' ? accept : reset,
          ).toHaveBeenCalledExactlyOnceWith({
            ...(mode === 'invite'
              ? { password: 'Apassword123', username: 'invited-user' }
              : { newPassword: 'Apassword123' }),
            ...(code ? { tenant: code } : { tenant_id: 2 }),
            token: 'opaque',
          }),
        );
        await vi.waitFor(() =>
          expect(container.textContent).toContain(
            mode === 'invite' ? '账号已创建' : '密码已更新',
          ),
        );
        expect(router.currentRoute.value.hash).toBe('');
        expect(router.currentRoute.value.query.tenant).toBe(code);
        expect(container.textContent).toContain('企业代码');
        const href = container.querySelector('a')?.getAttribute('href');
        if (!href) throw new Error('Missing login link');
        const login = new URL(href, 'http://localhost');
        expect(login.pathname).toBe('/auth/login');
        expect(login.searchParams.get('tenant')).toBe(code);
        expect(login.searchParams.has('tenant_id')).toBe(false);
        expect(login.hash).toBe('');
      },
    );
  },
);
