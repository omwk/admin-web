import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { createPinia, setActivePinia } from 'pinia';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationStore } from '#/store/notification';

import Inbox from '../index.vue';
import Badge from '../notification-badge.vue';

const api = vi.hoisted(() => ({
  count: vi.fn(),
  list: vi.fn(),
  preferences: vi.fn(),
  read: vi.fn(),
  all: vi.fn(),
  allowed: true,
}));
vi.mock('#/api/core/notifications', () => ({
  getUnreadCountApi: api.count,
  getNotificationsApi: api.list,
  getNotificationPreferencesApi: api.preferences,
  readNotificationApi: api.read,
  readAllNotificationsApi: api.all,
}));
vi.mock('#/auth/token', () => ({ getSessionVersion: () => 0 }));
vi.mock('#/auth/permission', () => ({ hasPermission: () => api.allowed }));
vi.mock('vue-router', () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
let app: ReturnType<typeof createApp> | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  api.allowed = true;
  api.count.mockResolvedValue({ count: 0 });
  setActivePinia(createPinia());
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(() => {
  app?.unmount();
  app = undefined;
  vi.useRealTimers();
  message.destroy();
  container.remove();
});
describe('notification badge lifecycle', () => {
  it('hides zero, polls every minute, refreshes on focus and cleans up on unmount', async () => {
    vi.useFakeTimers();
    app = createApp(Badge);
    app.mount(container);
    await vi.advanceTimersByTimeAsync(0);
    await nextTick();
    expect(
      container.querySelector('.ant-badge-count[data-show="true"]'),
    ).toBeNull();
    expect(
      container.querySelector<HTMLElement>('.ant-badge-count')?.style.display,
    ).toBe('none');
    expect(api.count).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(59_999);
    expect(api.count).toHaveBeenCalledTimes(1);
    api.count.mockResolvedValue({ count: 3 });
    await vi.advanceTimersByTimeAsync(1);
    await nextTick();
    expect(api.count).toHaveBeenCalledTimes(2);
    expect(useNotificationStore().count).toBe(3);
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.count).toHaveBeenCalledTimes(3);
    app.unmount();
    app = undefined;
    window.dispatchEvent(new Event('focus'));
    await vi.advanceTimersByTimeAsync(60_000);
    expect(api.count).toHaveBeenCalledTimes(3);
  });
});
describe('notification inbox reading', () => {
  it('shows backend titles/summary/names and opens full text while marking a row read', async () => {
    const row = {
      id: 19,
      title: '维护提醒',
      summary: '今晚例行维护',
      template_name: '系统公告',
      template: 'notification.broadcast',
      payload: { body: '完整维护正文\n后续内容' },
      read_at: null,
      created_at: '2026-11-19T01:00:00Z',
    };
    api.list.mockResolvedValue({ list: [row], total: 1 });
    api.preferences.mockResolvedValue({
      preferences: [{ template: row.template, name: row.template_name }],
    });
    api.read.mockResolvedValue(undefined);
    app = createApp(Inbox);
    app.mount(container);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('今晚例行维护'),
    );
    expect(container.textContent).toContain('维护提醒');
    expect(container.textContent).toContain('系统公告');
    const target = container.querySelector<HTMLElement>(
      '[data-notification-id="19"]',
    );
    if (!target) throw new Error('Missing inbox row');
    target.click();
    await vi.waitFor(() => expect(api.read).toHaveBeenCalledWith(19));
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-testid="notification-detail"]')
          ?.textContent,
      ).toContain('完整维护正文'),
    );
    await vi.waitFor(() =>
      expect(
        document.querySelector('[data-testid="notification-detail"]')
          ?.textContent,
      ).toContain('已读'),
    );
    expect(row.read_at).not.toBeNull();
  });
});
