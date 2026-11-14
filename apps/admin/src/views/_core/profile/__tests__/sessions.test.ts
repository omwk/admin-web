import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sessions from '../sessions.vue';

const state = vi.hoisted(() => ({ get: vi.fn(), logoutAll: vi.fn() }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('vue-router', () => ({ RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('#/auth/token', () => ({ getCurrentSessionId: () => 'current-sid' }));
vi.mock('#/store/auth', () => ({
  useAuthStore: () => ({ logoutAll: state.logoutAll }),
}));
vi.mock('#/api/core/self-service', () => ({ getMySessionsApi: state.get }));

let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  vi.clearAllMocks();
  state.get.mockResolvedValue({
    list: [
      {
        sid: 'current-sid',
        created_at: '2026-11-14T08:00:00Z',
        ip: '127.0.0.1',
        user_agent: 'Edge on Windows',
      },
      {
        sid: 'other-sid',
        created_at: '2026-11-14T07:00:00Z',
        ip: '127.0.0.2',
        user_agent: 'Firefox on Linux',
      },
    ],
    total: 2,
    page: 1,
    page_size: 20,
  });
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
});
async function mount() {
  app = createApp(Sessions);
  app.mount(root);
  await vi.waitFor(() => expect(root.textContent).toContain('Edge on Windows'));
}
function click(label: string) {
  const element = [...document.querySelectorAll('button')].find(
    (value) => value.textContent?.replaceAll(/\s/g, '') === label,
  );
  expect(element).toBeDefined();
  if (!element) throw new Error('Session action is missing');
  element.click();
}
describe('my sessions', () => {
  it('renders current/other devices and server pagination', async () => {
    await mount();
    expect(state.get).toHaveBeenCalledWith(1, 20);
    expect(root.textContent).toContain('127.0.0.1');
    expect(root.textContent).toContain('Firefox on Linux');
    expect(root.textContent).toContain('当前');
    expect(root.textContent).toContain('其他');
  });
  it('requires confirmation and leaves the session intact when cancelled', async () => {
    await mount();
    click('全部下线');
    await nextTick();
    expect(document.body.textContent).toContain('当前设备也将退出登录');
    expect(state.logoutAll).not.toHaveBeenCalled();
    click('取消');
    await nextTick();
    expect(state.logoutAll).not.toHaveBeenCalled();
  });
  it('shows a retryable error if revocation fails', async () => {
    state.logoutAll.mockRejectedValueOnce(new Error('offline'));
    await mount();
    click('全部下线');
    await nextTick();
    click('确认全部下线');
    await vi.waitFor(() => expect(state.logoutAll).toHaveBeenCalledTimes(1));
    await vi.waitFor(() => expect(root.textContent).toContain('请求失败'));
  });
});
