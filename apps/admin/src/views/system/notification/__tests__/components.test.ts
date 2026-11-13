import type { Component } from 'vue';

import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import Channels from '../channels.vue';
import Preferences from '../preferences.vue';
import ProviderForm from '../provider-form.vue';
import ProviderTest from '../provider-test.vue';

const api = vi.hoisted(() => ({
  preferences: vi.fn(),
  savePreferences: vi.fn(),
  saveProvider: vi.fn(),
  testProvider: vi.fn(),
  deliveries: vi.fn(),
  providers: vi.fn(),
  templates: vi.fn(),
  allowed: true,
}));
vi.mock('#/api/core/notifications', () => ({
  getNotificationPreferencesApi: api.preferences,
  saveNotificationPreferencesApi: api.savePreferences,
  saveNotificationProviderApi: api.saveProvider,
  testNotificationProviderApi: api.testProvider,
  getNotificationDeliveriesApi: api.deliveries,
  getNotificationProvidersApi: api.providers,
  getNotificationTemplatesApi: api.templates,
  deleteNotificationProviderApi: vi.fn(),
  saveNotificationTemplateApi: vi.fn(),
  retryNotificationDeliveryApi: vi.fn(),
}));
vi.mock('#/auth/permission', () => ({ hasPermission: () => api.allowed }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
let app: ReturnType<typeof createApp> | undefined;
let container: HTMLDivElement;
beforeEach(() => {
  vi.resetAllMocks();
  api.allowed = true;
  container = document.createElement('div');
  document.body.append(container);
});
afterEach(async () => {
  app?.unmount();
  app = undefined;
  message.destroy();
  await nextTick();
  container.remove();
});
function mount(component: Component, props: Record<string, unknown> = {}) {
  app = createApp(component, props);
  app.mount(container);
}
function button(text: string, root: ParentNode = document): HTMLButtonElement {
  const target = [...root.querySelectorAll<HTMLButtonElement>('button')].find(
    (value) => value.textContent?.replaceAll(/\s/g, '') === text,
  );
  if (!target) throw new Error(`Missing button: ${text}`);
  return target;
}
function fill(label: string, value: string) {
  const input = document.querySelector<HTMLInputElement>(
    `input[aria-label="${label}"]`,
  );
  if (!input) throw new Error(`Missing input: ${label}`);
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
}
describe('preference matrix interaction', () => {
  it('shows disabled inherited values, saves one false override and rereads it', async () => {
    const initial = {
      preferences: [
        {
          template: 'notification.default',
          channel: 'email',
          enabled: true,
          inherited: true,
        },
        {
          template: 'notification.default',
          channel: 'sms',
          enabled: false,
          inherited: true,
        },
      ],
    };
    const persisted = {
      preferences: [
        { ...initial.preferences[0], enabled: false, inherited: false },
        initial.preferences[1],
      ],
    };
    api.preferences
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(persisted);
    api.savePreferences.mockResolvedValue(persisted);
    mount(Preferences);
    await vi.waitFor(() =>
      expect(container.textContent).toContain('继承租户设置'),
    );
    const cell = container.querySelector<HTMLElement>(
      '[data-preference="notification.default:email"]',
    );
    if (!cell) throw new Error('Missing email cell');
    const toggle = cell.querySelector<HTMLButtonElement>('[role="switch"]');
    expect(toggle?.disabled).toBe(true);
    expect(container.textContent).toContain('站内通知仍会收到');
    button('自定义', cell).click();
    await nextTick();
    toggle?.click();
    await nextTick();
    button('保存偏好', container).click();
    await vi.waitFor(() =>
      expect(api.savePreferences).toHaveBeenCalledWith([
        { template: 'notification.default', channel: 'email', enabled: false },
      ]),
    );
    await vi.waitFor(() =>
      expect(button('保存偏好', container).disabled).toBe(true),
    );
    app?.unmount();
    mount(Preferences);
    await vi.waitFor(() => {
      const saved = container.querySelector<HTMLButtonElement>(
        '[data-preference="notification.default:email"] [role="switch"]',
      );
      expect(saved?.getAttribute('aria-checked')).toBe('false');
      expect(saved?.disabled).toBe(false);
    });
  });
  it('retains edits on a failed save and shows the backend message', async () => {
    api.preferences.mockResolvedValue({
      preferences: [
        {
          template: 'notification.default',
          channel: 'email',
          enabled: true,
          inherited: false,
        },
      ],
    });
    api.savePreferences.mockRejectedValue(
      new ApiError({ status: 400, message: '偏好保存失败：模板不可用' }),
    );
    mount(Preferences);
    await vi.waitFor(() =>
      expect(container.querySelector('[role="switch"]')).not.toBeNull(),
    );
    container.querySelector<HTMLButtonElement>('[role="switch"]')?.click();
    await nextTick();
    button('保存偏好', container).click();
    await vi.waitFor(() =>
      expect(container.textContent).toContain('偏好保存失败：模板不可用'),
    );
    expect(
      container.querySelector('[role="switch"]')?.getAttribute('aria-checked'),
    ).toBe('false');
    expect(button('保存偏好', container).disabled).toBe(false);
  });
});
describe('provider configuration privacy', () => {
  it('never repopulates saved private fields and omits them from an unchanged edit', async () => {
    const secret = crypto.randomUUID();
    const provider = {
      id: 1,
      name: '配置测试',
      kind: 'smtp',
      channel: 'email',
      enabled: true,
      priority: 0,
      config: {
        password: secret,
        password_configured: true,
        smtp_addr_configured: true,
        from_address_configured: true,
        tls_mode: 'tls',
      },
    };
    api.saveProvider.mockResolvedValue(provider);
    mount(ProviderForm, { provider });
    await nextTick();
    const password = document.querySelector<HTMLInputElement>(
      'input[aria-label="SMTP 密码"]',
    );
    expect(password?.type).toBe('password');
    expect(password?.value).toBe('');
    expect(password?.placeholder).toBe('已配置');
    expect(document.body.textContent).not.toContain(secret);
    document
      .querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary')
      ?.click();
    await vi.waitFor(() =>
      expect(api.saveProvider).toHaveBeenCalledWith(
        {
          name: '配置测试',
          enabled: true,
          priority: 0,
          kind: 'smtp',
          channel: 'email',
          config: { tls_mode: 'tls' },
        },
        1,
      ),
    );
  });
  it('redacts entered passwords from a rejected provider save', async () => {
    const secret = crypto.randomUUID();
    api.saveProvider.mockRejectedValue(
      new ApiError({ status: 400, message: `配置无效：${secret}` }),
    );
    mount(ProviderForm);
    fill('服务商名称', '表单验证');
    fill('SMTP 地址（host:port）', '127.0.0.1:2525');
    fill('发件人邮箱', `${crypto.randomUUID()}@example.invalid`);
    fill('SMTP 密码', secret);
    await nextTick();
    document
      .querySelector<HTMLButtonElement>('.ant-modal .ant-btn-primary')
      ?.click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('配置无效：已配置'),
    );
    expect(document.body.textContent).not.toContain(secret);
  });
});
describe('provider test result honesty', () => {
  const provider = { id: 2, name: '测试服务商' };
  it.each(['pending', 'sent', 'failed'])(
    'renders %s delivery status accurately',
    async (status) => {
      api.testProvider.mockResolvedValue({
        id: 3,
        status,
        attempts: 1,
        last_error: status === 'failed' ? 'provider_delivery_failed' : '',
      });
      mount(ProviderTest, { provider });
      button('发送给当前账号').click();
      await vi.waitFor(() => expect(api.testProvider).toHaveBeenCalledWith(2));
      const expected = {
        pending: '投递处理中',
        sent: '已发送，请查收',
        failed: 'provider_delivery_failed',
      }[status];
      await vi.waitFor(() =>
        expect(document.body.textContent).toContain(expected),
      );
      expect(document.body.textContent?.includes('已发送，请查收')).toBe(
        status === 'sent',
      );
    },
  );
  it('renders backend copy on a rejected test, including failure reason', async () => {
    api.testProvider.mockRejectedValue(
      new ApiError({
        status: 503,
        message: '测试发送失败：recipient_unavailable',
      }),
    );
    mount(ProviderTest, { provider });
    button('发送给当前账号').click();
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '测试发送失败：recipient_unavailable',
      ),
    );
  });
});
describe('channel permission boundary', () => {
  it('denies direct page access and does not load management APIs without manage', async () => {
    api.allowed = false;
    mount(Channels);
    await nextTick();
    expect(container.textContent).toContain('没有通知渠道管理权限');
    expect(container.textContent).not.toContain('服务商');
    expect(api.providers).not.toHaveBeenCalled();
    expect(api.templates).not.toHaveBeenCalled();
    expect(api.deliveries).not.toHaveBeenCalled();
  });
});
