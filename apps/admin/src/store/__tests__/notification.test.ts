import { createPinia, setActivePinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { useNotificationStore } from '../notification';

const api = vi.hoisted(() => ({ count: vi.fn(), session: 0 }));
vi.mock('#/api/core/notifications', () => ({ getUnreadCountApi: api.count }));
vi.mock('#/auth/token', () => ({ getSessionVersion: () => api.session }));
beforeEach(() => {
  vi.resetAllMocks();
  api.session = 0;
  setActivePinia(createPinia());
});
describe('notification badge session state', () => {
  it('uses the backend count and refreshes after reads', async () => {
    api.count
      .mockResolvedValueOnce({ count: 2 })
      .mockResolvedValueOnce({ count: 1 })
      .mockResolvedValueOnce({ count: 0 });
    const store = useNotificationStore();
    await store.refresh();
    expect(store.count).toBe(2);
    await store.refresh();
    expect(store.count).toBe(1);
    await store.refresh();
    expect(store.count).toBe(0);
  });
  it('ignores count responses from the previous session', async () => {
    let finish!: (value: { count: number }) => void;
    api.count.mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const store = useNotificationStore();
    const pending = store.refresh();
    api.session++;
    store.clear();
    finish({ count: 200 });
    await pending;
    expect(store.count).toBe(0);
  });
});
