import type { Component } from 'vue';

import { createApp, nextTick } from 'vue';

import { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Broadcasts from '../broadcasts.vue';
import { useBroadcastForm } from '../use-broadcast-form';

const api = vi.hoisted(() => ({
  preview: vi.fn(),
  create: vi.fn(),
  history: vi.fn(),
  users: vi.fn(),
  roles: vi.fn(),
  allowed: true,
}));
vi.mock('#/api/core/notifications', () => ({
  previewNotificationBroadcastApi: api.preview,
  createNotificationBroadcastApi: api.create,
  getNotificationBroadcastsApi: api.history,
}));
vi.mock('#/api/core/admin-users', () => ({ getUsersApi: api.users }));
vi.mock('#/api/core/system', () => ({ getAllRolesApi: api.roles }));
vi.mock('#/auth/permission', () => ({ hasPermission: () => api.allowed }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
  Fallback: { template: '<main>403</main>' },
}));
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
let state: ReturnType<typeof useBroadcastForm>;
const sent = vi.fn();
function mount(component?: Component) {
  app = createApp(
    component ?? {
      setup() {
        state = useBroadcastForm(sent);
        return () => null;
      },
    },
  );
  app.mount(container);
}
beforeEach(() => {
  vi.resetAllMocks();
  api.allowed = true;
  container = document.createElement('div');
  document.body.append(container);
  sent.mockResolvedValue(undefined);
});
afterEach(() => {
  app?.unmount();
  Modal.destroyAll();
  message.destroy();
  container.remove();
});
async function ready() {
  mount();
  state.form.title = '维护公告';
  state.form.body = '维护正文';
  await nextTick();
}
describe('broadcast publication', () => {
  it('discards stale previews and invalidates counts when any content changes', async () => {
    let resolve!: (value: { recipients: number }) => void;
    api.preview.mockImplementation(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await ready();
    const pending = state.preview();
    state.form.audience.type = 'users';
    state.userIds.value = [9];
    await nextTick();
    resolve({ recipients: 42 });
    await pending;
    expect(state.recipients.value).toBeUndefined();
    expect(state.previewing.value).toBe(false);
    api.preview.mockResolvedValue({ recipients: 1 });
    await state.preview();
    expect(state.recipients.value).toBe(1);
    state.form.channels = ['inbox'];
    await nextTick();
    expect(state.recipients.value).toBeUndefined();
    state.publish();
    expect(api.create).not.toHaveBeenCalled();
  });
  it('confirms recipients/channels and prevents duplicate confirmation and publication', async () => {
    api.preview.mockResolvedValue({ recipients: 2 });
    api.create.mockResolvedValue({ broadcast_id: 55, recipients: 2 });
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
    await ready();
    await state.preview();
    state.publish();
    state.publish();
    expect(confirm).toHaveBeenCalledTimes(1);
    const options = confirm.mock.calls[0]?.[0];
    if (!options) throw new Error('Missing confirmation');
    expect(options.content).toBe('将发送给 2 人，渠道：站内信、邮件。');
    expect(api.create).not.toHaveBeenCalled();
    await options.onOk?.();
    expect(api.create).toHaveBeenCalledWith({
      title: '维护公告',
      body: '维护正文',
      channels: ['inbox', 'email'],
      audience: { type: 'all' },
    });
    expect(sent).toHaveBeenCalledOnce();
    expect(state.form.title).toBe('');
  });
  it('retains content and displays server failures after confirmation', async () => {
    api.preview.mockResolvedValue({ recipients: 2 });
    api.create.mockRejectedValue(new Error('发布失败，请重试'));
    const confirm = vi
      .spyOn(Modal, 'confirm')
      .mockReturnValue({ destroy: vi.fn(), update: vi.fn() });
    await ready();
    await state.preview();
    state.publish();
    const options = confirm.mock.calls[0]?.[0];
    if (!options) throw new Error('Missing confirmation');
    await options.onOk?.();
    expect(state.error.value).toBe('发布失败，请重试');
    expect(state.form.title).toBe('维护公告');
    expect(state.locked.value).toBe(false);
  });
  it('renders a full 403 without fetching data for a denied user', async () => {
    api.allowed = false;
    mount(Broadcasts);
    await nextTick();
    expect(container.textContent).toBe('403');
    expect(api.history).not.toHaveBeenCalled();
    expect(api.roles).not.toHaveBeenCalled();
    expect(api.users).not.toHaveBeenCalled();
  });
});
