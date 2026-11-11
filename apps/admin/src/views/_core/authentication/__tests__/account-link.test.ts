import type { VNode } from 'vue';
import type { RouteLocationNormalizedLoaded } from 'vue-router';

import { cloneVNode, createApp, h, nextTick } from 'vue';
import { createMemoryHistory, createRouter, RouterView } from 'vue-router';

import { describe, expect, it, vi } from 'vitest';

import AccountLink from '../account-link.vue';

const reset = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('#/api/core/invites', () => ({
  consumeResetLinkApi: reset,
  acceptInviteApi: vi.fn(),
}));

describe('public password reset form', () => {
  it('submits the form and retains its success screen after removing the credential URL', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: '/auth/password/reset',
          component: AccountLink,
          props: { mode: 'reset' },
        },
        {
          path: '/auth/account-complete',
          name: 'AccountLinkComplete',
          component: AccountLink,
          props: { mode: 'reset', complete: true },
        },
      ],
    });
    await router.push('/auth/password/reset?tenant_id=1#token=opaque');
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp({
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
    try {
      await nextTick();
      for (const label of ['新密码', '确认密码']) {
        const input = container.querySelector<HTMLInputElement>(
          `input[aria-label="${label}"]`,
        );
        if (!input) throw new Error(`Missing password field: ${label}`);
        input.value = 'Apassword123';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      }
      await nextTick();
      const button = container.querySelector<HTMLButtonElement>(
        'button[type="submit"]',
      );
      if (!button) throw new Error('Missing submit button');
      button.click();
      await vi.waitFor(() =>
        expect(reset).toHaveBeenCalledWith({
          newPassword: 'Apassword123',
          tenant_id: 1,
          token: 'opaque',
        }),
      );
      await vi.waitFor(() =>
        expect(container.textContent).toContain('密码已更新'),
      );
      expect(router.currentRoute.value.hash).toBe('');
      expect(container.textContent).toContain('前往登录');
    } finally {
      app.unmount();
      container.remove();
    }
  });
});
