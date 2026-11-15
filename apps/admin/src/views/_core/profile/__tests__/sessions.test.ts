import type { MockInstance } from 'vitest';

import type { IdentitySession } from '#/api/model/identity';

import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Sessions from '../sessions.vue';

const state = vi.hoisted(() => ({
  get: vi.fn(),
  logoutAll: vi.fn(),
  logoutOthers: vi.fn(),
  revoke: vi.fn(),
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('vue-router', () => ({ RouterLink: { template: '<a><slot /></a>' } }));
vi.mock('#/auth/token', () => ({ getCurrentSessionId: () => 'current-sid' }));
vi.mock('#/store/auth', () => ({
  useAuthStore: () => ({ logoutAll: state.logoutAll }),
}));
vi.mock('#/api/core/self-service', () => ({
  getMySessionsApi: state.get,
  logoutOthersApi: state.logoutOthers,
  revokeMySessionApi: state.revoke,
}));

const currentSession: IdentitySession = {
  sid: 'current-sid',
  user_id: 3,
  created_at: '2026-11-14T08:00:00Z',
  expires_at: '2026-11-21T08:00:00Z',
  ip: '127.0.0.1',
  user_agent: 'Edge on Windows',
  current: true,
};
const otherSession: IdentitySession = {
  sid: 'other-sid',
  user_id: 3,
  created_at: '2026-11-14T07:00:00Z',
  expires_at: '2026-11-21T07:00:00Z',
  ip: '127.0.0.2',
  user_agent: 'Firefox on Linux',
  current: false,
};
function result(
  list: IdentitySession[] = [currentSession, otherSession],
  total = list.length,
) {
  return { list, total, page: 1, page_size: 20 };
}

let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
let success: MockInstance;
beforeEach(() => {
  vi.clearAllMocks();
  state.get.mockReset().mockResolvedValue(result());
  state.logoutAll.mockReset().mockResolvedValue(undefined);
  state.logoutOthers.mockReset().mockResolvedValue({ revoked: 1 });
  state.revoke.mockReset().mockResolvedValue(undefined);
  success = vi.spyOn(message, 'success');
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app?.unmount();
  root.remove();
  message.destroy();
});
async function mount(expected = 'Edge on Windows') {
  app = createApp(Sessions);
  app.mount(root);
  await vi.waitFor(() => expect(root.textContent).toContain(expected));
}
function button(label: string, scope: ParentNode = document) {
  const element = [...scope.querySelectorAll('button')].find(
    (value) => value.textContent?.replaceAll(/\s/g, '') === label,
  );
  expect(element).toBeDefined();
  if (!element) throw new Error('Session action is missing');
  return element;
}
function click(label: string) {
  button(label).click();
}
function row(sid: string) {
  const element = root.querySelector(`tr[data-row-key="${sid}"]`);
  if (!element) throw new Error('Session row is missing');
  return element;
}
describe('my sessions', () => {
  it('renders current/other devices and server pagination', async () => {
    await mount();
    expect(state.get).toHaveBeenCalledWith(1, 20);
    expect(root.textContent).toContain('127.0.0.1');
    expect(root.textContent).toContain('Firefox on Linux');
    expect(root.textContent).toContain('当前');
    expect(root.textContent).toContain('其他');
    expect(row('current-sid').textContent).toContain('当前设备');
    expect(row('current-sid').querySelector('button')).toBeNull();
    expect(button('下线', row('other-sid')).disabled).toBe(false);
    expect(button('下线其他设备').disabled).toBe(false);
  });
  it.each([0, 1])(
    'disables logout-others when the server total is %s',
    async (total) => {
      state.get.mockResolvedValue(result(total ? [currentSession] : [], total));
      await mount(total ? 'Edge on Windows' : '暂无登录会话');
      expect(button('下线其他设备').disabled).toBe(true);
      click('下线其他设备');
      await nextTick();
      expect(state.logoutOthers).not.toHaveBeenCalled();
    },
  );
  it('uses the server total for confirmation even when only part of the list is visible', async () => {
    state.get.mockResolvedValue(result([otherSession], 21));
    await mount('Firefox on Linux');
    click('下线其他设备');
    await nextTick();
    expect(document.body.textContent).toContain(
      '将下线除当前设备外的 20 个会话，确定？',
    );
    expect(state.logoutOthers).not.toHaveBeenCalled();
    click('取消');
    await nextTick();
    expect(state.logoutOthers).not.toHaveBeenCalled();
  });
  it('trusts the server current flag over the local token SID', async () => {
    state.get.mockResolvedValue(
      result([
        { ...currentSession, current: false },
        { ...otherSession, current: true },
      ]),
    );
    await mount();
    expect(button('下线', row('current-sid')).disabled).toBe(false);
    expect(row('other-sid').querySelector('button')).toBeNull();
    expect(row('other-sid').textContent).toContain('当前设备');
  });
  it('requires explicit other-session metadata before offering a row revocation', async () => {
    const legacy = { ...otherSession, current: undefined };
    state.get.mockResolvedValue(result([currentSession, legacy]));
    await mount();
    expect(row('other-sid').querySelector('button')).toBeNull();
  });
  it('confirms single-session logout, refreshes the list and keeps the current login', async () => {
    await mount();
    click('下线');
    await nextTick();
    expect(state.revoke).not.toHaveBeenCalled();
    click('取消');
    await nextTick();
    expect(state.revoke).not.toHaveBeenCalled();
    state.get.mockResolvedValueOnce(result([currentSession]));
    click('下线');
    await nextTick();
    click('确认下线会话');
    await vi.waitFor(() =>
      expect(state.revoke).toHaveBeenCalledExactlyOnceWith('other-sid'),
    );
    await vi.waitFor(() =>
      expect(root.textContent).not.toContain('Firefox on Linux'),
    );
    expect(root.textContent).toContain('当前设备');
    expect(state.get).toHaveBeenLastCalledWith(1, 20);
    expect(button('下线其他设备').disabled).toBe(true);
    expect(state.logoutAll).not.toHaveBeenCalled();
  });
  it('returns to the preceding page after deleting the last row on a later page', async () => {
    state.get.mockResolvedValue(result([currentSession, otherSession], 21));
    await mount();
    state.get.mockResolvedValueOnce(result([otherSession], 21));
    const nextPage = root.querySelector<HTMLElement>('.ant-pagination-item-2');
    expect(nextPage).not.toBeNull();
    nextPage?.click();
    await vi.waitFor(() => expect(state.get).toHaveBeenLastCalledWith(2, 20));
    await vi.waitFor(() =>
      expect(root.textContent).not.toContain('Edge on Windows'),
    );
    state.get.mockResolvedValueOnce(result([currentSession], 20));
    click('下线');
    await nextTick();
    click('确认下线会话');
    await vi.waitFor(() => expect(state.get).toHaveBeenLastCalledWith(1, 20));
    await vi.waitFor(() => expect(root.textContent).toContain('当前设备'));
  });
  it('shows the actual revoked count, resets pagination and blocks duplicate submissions', async () => {
    let finish: ((value: { revoked: number }) => void) | undefined;
    state.logoutOthers.mockReturnValueOnce(
      new Promise((resolve) => {
        finish = resolve;
      }),
    );
    await mount();
    state.get.mockResolvedValueOnce(result([currentSession]));
    click('下线其他设备');
    await nextTick();
    expect(document.body.textContent).toContain(
      '将下线除当前设备外的 1 个会话，确定？',
    );
    click('确认下线其他设备');
    click('确认下线其他设备');
    await nextTick();
    expect(state.logoutOthers).toHaveBeenCalledTimes(1);
    expect(button('刷新').disabled).toBe(true);
    expect(button('全部下线').disabled).toBe(true);
    expect(button('下线').disabled).toBe(true);
    expect(button('取消').disabled).toBe(true);
    finish?.({ revoked: 7 });
    await vi.waitFor(() =>
      expect(success).toHaveBeenCalledWith('已下线 7 个会话'),
    );
    await vi.waitFor(() => expect(button('下线其他设备').disabled).toBe(true));
    expect(state.get).toHaveBeenLastCalledWith(1, 20);
    expect(root.textContent).toContain('当前设备');
    expect(root.textContent).not.toContain('Firefox on Linux');
    expect(state.logoutAll).not.toHaveBeenCalled();
  });
  it.each(['single', 'others'])(
    'keeps rows and offers a retry when %s revocation fails',
    async (mode) => {
      const action = mode === 'single' ? state.revoke : state.logoutOthers;
      action.mockRejectedValueOnce(new Error('offline'));
      await mount();
      click(mode === 'single' ? '下线' : '下线其他设备');
      await nextTick();
      click(mode === 'single' ? '确认下线会话' : '确认下线其他设备');
      await vi.waitFor(() => expect(root.textContent).toContain('请求失败'));
      expect(action).toHaveBeenCalledTimes(1);
      expect(state.get).toHaveBeenCalledTimes(1);
      expect(root.textContent).toContain('当前设备');
      expect(root.textContent).toContain('Firefox on Linux');
      expect(button('下线其他设备').disabled).toBe(false);
      expect(button('下线').disabled).toBe(false);
      expect(state.logoutAll).not.toHaveBeenCalled();
      expect(success).not.toHaveBeenCalled();
    },
  );
  it('delegates confirmed logout-all to the existing auth-store redirect flow', async () => {
    await mount();
    click('全部下线');
    await nextTick();
    click('确认全部下线');
    await vi.waitFor(() => expect(state.logoutAll).toHaveBeenCalledTimes(1));
    expect(state.logoutOthers).not.toHaveBeenCalled();
    expect(state.revoke).not.toHaveBeenCalled();
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
