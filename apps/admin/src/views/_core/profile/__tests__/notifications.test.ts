import type { PersonalNotificationChannelView } from '#/api/model/notification';

import { createApp, nextTick } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { message, Modal } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import Notifications from '../notifications.vue';

const api = vi.hoisted(() => ({
  get: vi.fn(),
  save: vi.fn(),
  test: vi.fn(),
  remove: vi.fn(),
  profile: vi.fn(),
}));
vi.mock('#/api/core/personal-notification-channels', () => ({
  getPersonalNotificationChannelsApi: api.get,
  savePersonalNotificationChannelApi: api.save,
  testPersonalNotificationChannelApi: api.test,
  deletePersonalNotificationChannelApi: api.remove,
}));
vi.mock('#/api/core/self-service', () => ({ getMyProfileApi: api.profile }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
let rows: PersonalNotificationChannelView[];
function channel(verified = false): PersonalNotificationChannelView {
  return {
    channel: 'bark',
    endpoint_masked: 'https://example.test/…/****',
    enabled: true,
    verified_at: verified ? new Date().toISOString() : null,
    created_at: '',
    updated_at: '',
  };
}
function button(text: string, parent: ParentNode = document) {
  const found = [...parent.querySelectorAll<HTMLButtonElement>('button')].find(
    (item) => item.textContent?.replaceAll(/\s/g, '') === text,
  );
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}
function card() {
  const value = root.querySelector<HTMLElement>('[data-channel="bark"]');
  if (!value) throw new Error('Missing Bark card');
  return value;
}
async function mount() {
  root = document.createElement('div');
  document.body.append(root);
  app = createApp(Notifications);
  app.use(
    createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/:path(.*)*', component: {} }],
    }),
  );
  app.mount(root);
  await nextTick();
  await vi.waitFor(() =>
    expect(root.textContent).toContain('reader@example.test'),
  );
  await vi.waitFor(() => expect(button('刷新', root).disabled).toBe(false));
}
async function configure(endpoint: string) {
  button(rows.length > 0 ? '修改配置' : '配置', card()).click();
  await nextTick();
  const input = document.querySelector<HTMLInputElement>(
    'input[aria-label="推送 URL"]',
  );
  if (!input) throw new Error('Missing endpoint input');
  input.value = endpoint;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await nextTick();
  button('保存并测试').click();
}
beforeEach(() => {
  vi.resetAllMocks();
  rows = [];
  api.profile.mockResolvedValue({ email: 'reader@example.test' });
  api.get.mockImplementation(async () => ({
    channels: rows.map((item) => ({ ...item })),
  }));
  api.save.mockImplementation(async () => {
    rows = [channel()];
    return { ...rows[0] };
  });
  api.test.mockImplementation(async () => {
    rows = [channel(true)];
    return { status: 'sent' };
  });
  api.remove.mockImplementation(async () => {
    rows = [];
  });
});
afterEach(async () => {
  app?.unmount();
  Modal.destroyAll();
  message.destroy();
  await nextTick();
  root?.remove();
});
describe('personal notification destinations', () => {
  it('shows read-only account email, three URL cards and configuration states', async () => {
    await mount();
    expect(root.textContent).toContain('reader@example.test');
    expect(root.querySelectorAll('[data-channel]')).toHaveLength(3);
    expect(root.textContent).not.toContain('短信');
    expect(
      root.querySelector('[data-testid="personal-email"] input'),
    ).toBeNull();
    expect(card().textContent).toContain('未配置');
    expect(button('配置', card()).disabled).toBe(false);
  });
  it('saves once before testing and only shows verified after fresh server confirmation', async () => {
    const endpoint = new URL(crypto.randomUUID(), 'https://example.test').href;
    let finish!: () => void;
    api.test.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = () => {
            rows = [channel(true)];
            resolve({ status: 'sent' });
          };
        }),
    );
    await mount();
    await configure(endpoint);
    await vi.waitFor(() =>
      expect(api.test).toHaveBeenCalledExactlyOnceWith('bark'),
    );
    expect(api.save).toHaveBeenCalledExactlyOnceWith('bark', endpoint);
    expect(api.save.mock.invocationCallOrder[0]).toBeLessThan(
      api.test.mock.invocationCallOrder[0] ?? 0,
    );
    expect(card().textContent).toContain('未验证');
    expect(card().textContent).not.toContain('已验证');
    expect(root.textContent).not.toContain(endpoint);
    expect(button('测试', card()).disabled).toBe(true);
    finish();
    await vi.waitFor(() => expect(card().textContent).toContain('已验证'));
    expect(
      card().querySelector('[data-testid="channel-endpoint"]')?.textContent,
    ).toContain('****');
  });
  it('keeps a failed HTTP-200 delivery unverified and displays its reason', async () => {
    api.test.mockResolvedValue({
      status: 'failed',
      last_error_message: '目标服务拒绝接收通知',
    });
    await mount();
    await configure(new URL(crypto.randomUUID(), 'https://example.test').href);
    await vi.waitFor(() =>
      expect(root.textContent).toContain('测试失败：目标服务拒绝接收通知'),
    );
    expect(card().textContent).toContain('未验证');
    expect(card().textContent).not.toContain('已验证');
    expect(button('测试', card()).disabled).toBe(false);
  });
  it('does not trust sent without a verified timestamp and refreshes again on manual test', async () => {
    rows = [channel()];
    api.test.mockResolvedValue({ status: 'sent' });
    await mount();
    button('测试', card()).click();
    await vi.waitFor(() =>
      expect(root.textContent).toContain('暂未确认验证状态'),
    );
    expect(card().textContent).not.toContain('已验证');
    expect(api.get).toHaveBeenCalledTimes(2);
  });
  it('preserves SSRF business errors without testing or leaking the submitted URL', async () => {
    const endpoint = new URL(crypto.randomUUID(), 'https://example.test').href;
    api.save.mockRejectedValue(
      new ApiError({
        status: 400,
        message: `个人渠道地址必须使用公网主机：${endpoint}`,
      }),
    );
    await mount();
    await configure(endpoint);
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain(
        '个人渠道地址必须使用公网主机：已配置',
      ),
    );
    expect(document.body.textContent).not.toContain(endpoint);
    expect(api.test).not.toHaveBeenCalled();
    expect(card().textContent).toContain('未配置');
  });
  it('rejects non-HTTPS addresses before saving', async () => {
    await mount();
    await configure('http://example.test');
    await vi.waitFor(() =>
      expect(document.body.textContent).toContain('请输入有效的 HTTPS URL'),
    );
    expect(api.save).not.toHaveBeenCalled();
  });
  it('requires confirmation before deleting and returns to the unconfigured state', async () => {
    rows = [channel(true)];
    await mount();
    button('删除', card()).click();
    await nextTick();
    expect(api.remove).not.toHaveBeenCalled();
    const confirmation =
      document.querySelector<HTMLElement>('.ant-modal-confirm');
    if (!confirmation) throw new Error('Missing delete confirmation');
    expect(confirmation.textContent).toContain('删除 Bark 通知方式？');
    button('删除', confirmation).click();
    await vi.waitFor(() =>
      expect(api.remove).toHaveBeenCalledExactlyOnceWith('bark'),
    );
    await vi.waitFor(() => expect(card().textContent).toContain('未配置'));
    expect(button('配置', card()).disabled).toBe(false);
  });
});
