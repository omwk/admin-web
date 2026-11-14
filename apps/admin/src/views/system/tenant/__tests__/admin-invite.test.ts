import type { Tenant, TenantAdminInviteResult } from '#/api/model/tenant';

import { createApp, h, KeepAlive, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import AdminInvite from '../admin-invite.vue';

const state = vi.hoisted(() => ({ allowed: true, send: vi.fn() }));
vi.mock('#/auth/tenant', () => ({ canManageTenants: () => state.allowed }));
vi.mock('#/api/core/tenants', () => ({
  reissueTenantAdminInviteApi: state.send,
}));
const tenant: Tenant = {
  id: 8,
  code: 'acme',
  name: 'Acme',
  status: 'active',
  admin_active_count: 0,
  member_count: 1,
  provisioned_from: null,
  created_at: '',
  updated_at: '',
};
const invitation: TenantAdminInviteResult = {
  invite_url: '/auth/invite/accept?tenant_id=8#token=ephemeral-fixture',
  expires_at: '2026-11-21T00:00:00Z',
};
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
function buttons(text: string) {
  return [...document.querySelectorAll<HTMLButtonElement>('button')].filter(
    (item) => item.textContent?.replaceAll(/\s/g, '') === text,
  );
}
function button(text: string) {
  const found = buttons(text)[0];
  if (!found) throw new Error(`Missing button: ${text}`);
  return found;
}
function mount(value = tenant) {
  app = createApp(AdminInvite, { tenant: value, disabled: false });
  app.mount(root);
}
const link = () =>
  document.querySelector<HTMLTextAreaElement>('[aria-label="账号链接"]');
beforeEach(() => {
  state.allowed = true;
  state.send.mockReset().mockResolvedValue(invitation);
  localStorage.clear();
  sessionStorage.clear();
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});

describe('tenant administrator invitation', () => {
  it('directly issues once, keeps the link out of storage and discards it on close/remount', async () => {
    mount();
    button('重发管理员邀请').click();
    button('重发管理员邀请').click();
    await vi.waitFor(() =>
      expect(link()?.value).toContain('ephemeral-fixture'),
    );
    expect(state.send).toHaveBeenCalledExactlyOnceWith(8, false);
    expect(
      JSON.stringify([
        Object.values(localStorage),
        Object.values(sessionStorage),
      ]),
    ).not.toContain('ephemeral-fixture');
    const close = document.querySelector<HTMLButtonElement>('.ant-modal-close');
    if (!close) throw new Error('Missing invitation close button');
    close.click();
    await vi.waitFor(() => expect(link()).toBeNull());
    app.unmount();
    mount();
    expect(link()).toBeNull();
    expect(state.send).toHaveBeenCalledOnce();
  });

  it('requires explicit confirmation for existing administrators and cancellation sends nothing', async () => {
    mount({ ...tenant, admin_active_count: 2 });
    button('重置管理员').click();
    await nextTick();
    expect(document.body.textContent).toContain(
      '该租户已有 2 个管理员，重发会作废未使用的旧邀请。继续？',
    );
    expect(state.send).not.toHaveBeenCalled();
    button('取消').click();
    await nextTick();
    expect(state.send).not.toHaveBeenCalled();
    button('重置管理员').click();
    await nextTick();
    button('确认重发').click();
    await vi.waitFor(() => expect(link()).not.toBeNull());
    expect(state.send).toHaveBeenCalledExactlyOnceWith(8, true);
  });

  it('preserves backend conflicts and never retries them with force automatically', async () => {
    state.send.mockRejectedValueOnce(
      new ApiError({
        status: 409,
        code: 10_004,
        message: '该租户已有管理员',
        config: { preserveBusinessMessage: true } as never,
      }),
    );
    mount();
    button('重发管理员邀请').click();
    await vi.waitFor(() =>
      expect(root.textContent).toContain('该租户已有管理员'),
    );
    expect(state.send).toHaveBeenCalledExactlyOnceWith(8, false);
    expect(link()).toBeNull();
  });

  it('disables suspended tenants and hides invitation actions without manage', async () => {
    mount({ ...tenant, status: 'suspended' });
    expect(buttons('重发管理员邀请')[0]?.disabled).toBe(true);
    button('重发管理员邀请').click();
    expect(state.send).not.toHaveBeenCalled();
    app.unmount();
    state.allowed = false;
    mount();
    expect(buttons('重发管理员邀请')).toHaveLength(0);
    expect(buttons('重置管理员')).toHaveLength(0);
  });

  it('drops late responses when a kept-alive view is left and never restores a displayed link', async () => {
    let finish!: (result: TenantAdminInviteResult) => void;
    state.send.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const visible = ref(true);
    app = createApp({
      render: () =>
        h(KeepAlive, null, {
          default: () =>
            visible.value ? h(AdminInvite, { tenant, disabled: false }) : null,
        }),
    });
    app.mount(root);
    button('重发管理员邀请').click();
    await vi.waitFor(() => expect(state.send).toHaveBeenCalledOnce());
    visible.value = false;
    await nextTick();
    finish(invitation);
    await nextTick();
    visible.value = true;
    await nextTick();
    expect(link()).toBeNull();
    button('重发管理员邀请').click();
    await vi.waitFor(() => expect(link()).not.toBeNull());
    visible.value = false;
    await nextTick();
    visible.value = true;
    await nextTick();
    expect(link()).toBeNull();
  });
});
