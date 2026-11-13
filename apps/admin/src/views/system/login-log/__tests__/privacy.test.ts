import { createApp, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import LoginLogPage from '../index.vue';

const api = vi.hoisted(() => ({ list: vi.fn(), allowed: true }));
vi.mock('#/api/core/audit', () => ({ getLoginLogsApi: api.list }));
vi.mock('#/auth/permission', () => ({ hasPermission: () => api.allowed }));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/views/_core/fallback/forbidden.vue', () => ({
  default: { template: '<div>403</div>' },
}));
let app: ReturnType<typeof createApp>;
const container = document.createElement('div');
afterEach(async () => {
  app?.unmount();
  await nextTick();
  container.replaceChildren();
  vi.clearAllMocks();
  api.allowed = true;
});
describe('unknown account privacy', () => {
  it('never renders input strings even if an unknown row contains an unexpected username or extra payload', async () => {
    const attempted = 'raw-attempted-account@example.invalid';
    const base = {
      id: 1,
      user_id: null,
      resource_id: 'unknown',
      username: attempted,
      result: 'failure',
      ip: '',
      user_agent: '',
      created_at: '2026-11-13T01:00:00Z',
      input: attempted,
      after: { username: attempted },
    };
    api.list.mockResolvedValue({
      list: [
        base,
        { ...base, id: 2, user_id: 7 },
        { ...base, id: 3, resource_id: '7' },
      ],
      page: 1,
      page_size: 20,
      total: 3,
    });
    app = createApp(LoginLogPage);
    app.mount(container);
    await vi.waitFor(() => expect(container.textContent).toContain('未知账号'));
    expect(container.innerHTML).not.toContain(attempted);
    expect(container.querySelectorAll('[data-row-key]')).toHaveLength(3);
    expect(container.textContent).not.toMatch(/导出|编辑|删除/);
  });
  it('renders 403 and makes no request without audit permission', async () => {
    api.allowed = false;
    app = createApp(LoginLogPage);
    app.mount(container);
    await nextTick();
    expect(container.textContent).toBe('403');
    expect(api.list).not.toHaveBeenCalled();
  });
});
