import type { Component } from 'vue';

import type { NotificationPreferenceView } from '#/api/model/notification';

import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { afterEach, describe, expect, it, vi } from 'vitest';

import PreferenceCell from '../preference-cell.vue';
import Preferences from '../preferences.vue';

const api = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock('#/api/core/notifications', () => ({
  getNotificationPreferencesApi: api.get,
  saveNotificationPreferencesApi: vi.fn(),
}));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
const preference = (
  values: Partial<NotificationPreferenceView> = {},
): NotificationPreferenceView => ({
  template: 'notification.default',
  name: '业务通知',
  channel: 'bark',
  available: false,
  reason: 'not_configured',
  transactional: false,
  enabled: false,
  inherited: true,
  ...values,
});
function mount(component: Component, props = {}) {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(component, props);
  app.use(
    createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:path(.*)*', component: {} }],
    }),
  );
  app.mount(root);
}
afterEach(() => {
  app?.unmount();
  root?.remove();
  vi.clearAllMocks();
});
describe('preference channel availability', () => {
  it.each([
    ['not_configured', '尚未配置通知方式'],
    ['not_verified', '通知方式尚未验证，请先测试'],
    ['missing_email', '账号尚未填写邮箱'],
    ['disabled', '通知方式已停用'],
  ])(
    'localizes %s, removes the switch and links to personal configuration',
    (reason, label) => {
      mount(PreferenceCell, {
        value: preference({ reason }),
        saving: false,
        label: 'Bark',
      });
      expect(root.textContent).toContain('未配置');
      expect(root.textContent).toContain(label);
      expect(root.textContent).not.toContain(reason);
      expect(root.querySelector('[role="switch"]')).toBeNull();
      expect(root.querySelector('a')?.getAttribute('href')).toBe(
        '/profile/notifications',
      );
    },
  );
  it('keeps transactional mail on and locked even when a stale value says false', () => {
    mount(PreferenceCell, {
      value: preference({
        channel: 'email',
        available: true,
        transactional: true,
        enabled: false,
      }),
      saving: false,
      label: '邮件',
    });
    const toggle = root.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle?.disabled).toBe(true);
    expect(toggle?.getAttribute('aria-checked')).toBe('true');
    expect(root.textContent).toContain('安全邮件（验证/重置/邀请）不可关闭');
  });
  it('shows Bark after verification and never includes legacy phone or robot channels', async () => {
    api.get.mockResolvedValue({
      preferences: [
        preference({ available: true, enabled: true, reason: '' }),
        preference({ channel: 'sms' }),
        preference({ channel: 'wecom' }),
        preference({ channel: 'dingtalk' }),
      ],
    });
    mount(Preferences);
    await vi.waitFor(() =>
      expect(
        root.querySelector(
          '[data-preference="notification.default:bark"] [role="switch"]',
        ),
      ).not.toBeNull(),
    );
    expect(root.textContent).toContain('Bark');
    expect(root.textContent).not.toContain('短信');
    expect(root.textContent).not.toContain('企微');
    expect(root.textContent).not.toContain('钉钉');
  });
});
