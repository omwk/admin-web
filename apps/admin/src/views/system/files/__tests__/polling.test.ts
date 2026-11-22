import type { LibraryFile } from '#/api/model/storage';

import { createApp, h, KeepAlive, nextTick, ref } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useFilePage } from '../use-file-page';

const mock = vi.hoisted(() => ({ list: vi.fn(), usage: vi.fn() }));
vi.mock('#/api/core/files', () => ({
  getFilesApi: mock.list,
  getFileUsageApi: mock.usage,
  deleteFileApi: vi.fn(),
  downloadFileApi: vi.fn(),
  getFileUrlApi: vi.fn(),
}));
vi.mock('#/auth/permission', () => ({ hasPermission: () => true }));
vi.mock('ant-design-vue', () => ({ message: {}, Modal: {} }));

const pending = {
  id: 1,
  category: 'image',
  original_name: 'large.png',
  thumb_status: 'pending',
  thumb_url: null,
} as LibraryFile;
const result = (file = pending) => ({ list: [{ ...file }], total: 30 });
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
let visible: ReturnType<typeof ref<boolean>>;
function mount() {
  let state!: ReturnType<typeof useFilePage>;
  visible = ref(true);
  const page = {
    setup() {
      state = useFilePage();
      return () => null;
    },
  };
  container = document.createElement('div');
  document.body.append(container);
  app = createApp({
    render: () => h(KeepAlive, null, () => (visible.value ? h(page) : null)),
  });
  app.mount(container);
  return state;
}
beforeEach(() => {
  vi.useFakeTimers();
  mock.list.mockReset().mockResolvedValue(result());
  mock.usage.mockReset().mockResolvedValue({ used_bytes: 0, quota_bytes: 100 });
});
afterEach(() => {
  app?.unmount();
  container?.remove();
  vi.useRealTimers();
});

describe('pending thumbnail refresh', () => {
  it('refreshes at five seconds and stops when the thumbnail is ready', async () => {
    const state = mount();
    await vi.advanceTimersByTimeAsync(0);
    const row = state.rows.value[0];
    mock.list.mockResolvedValue(
      result({ ...pending, thumb_status: 'ready', thumb_url: '/thumb.png' }),
    );
    await vi.advanceTimersByTimeAsync(4999);
    expect(mock.list).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(1);
    expect(mock.list).toHaveBeenCalledTimes(2);
    expect(state.rows.value[0]).toBe(row);
    expect(row?.thumb_status).toBe('ready');
    expect(row?.thumb_url).toBe('/thumb.png');
    expect(mock.usage).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(2);
  });

  it.each(['', 'failed', 'ready'] as const)(
    'never polls an initial %s status',
    async (thumb_status) => {
      mock.list.mockResolvedValue(result({ ...pending, thumb_status }));
      mount();
      await vi.advanceTimersByTimeAsync(60_000);
      expect(mock.list).toHaveBeenCalledTimes(1);
    },
  );

  it('stops after twelve refreshes and restarts on an explicit refresh', async () => {
    const state = mount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(13);
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(13);
    await state.load();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.list).toHaveBeenCalledTimes(15);
  });

  it('keeps draft and applied filters, page, rows and open operations while polling', async () => {
    const state = mount();
    await vi.advanceTimersByTimeAsync(0);
    state.filters.keyword = ' photo ';
    state.filters.category = 'image';
    state.query();
    await vi.advanceTimersByTimeAsync(0);
    state.changePage({ current: 2, pageSize: 20 });
    await vi.advanceTimersByTimeAsync(0);
    const rows = state.rows.value;
    state.filters.keyword = 'unsubmitted draft';
    state.filters.category = 'document';
    state.previewFile.value = pending;
    state.previewUrl.value = '/original.png';
    state.busy.value = true;
    let resolve!: (value: unknown) => void;
    mock.list.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.list).toHaveBeenLastCalledWith(2, 20, {
      keyword: 'photo',
      category: 'image',
    });
    expect(state.loading.value).toBe(false);
    await vi.advanceTimersByTimeAsync(15_000);
    expect(mock.list).toHaveBeenCalledTimes(4);
    resolve(result({ ...pending, thumb_status: 'failed' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.rows.value).toBe(rows);
    expect(state.pagination.current).toBe(2);
    expect(state.pagination.total).toBe(30);
    expect(state.filters).toEqual({
      category: 'document',
      keyword: 'unsubmitted draft',
    });
    expect(state.previewFile.value?.id).toBe(1);
    expect(state.previewUrl.value).toBe('/original.png');
    expect(state.busy.value).toBe(true);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(mock.list).toHaveBeenCalledTimes(4);
  });

  it('ignores a late background response after a foreground query', async () => {
    const state = mount();
    await vi.advanceTimersByTimeAsync(0);
    let resolve!: (value: unknown) => void;
    mock.list.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    await vi.advanceTimersByTimeAsync(5000);
    mock.list.mockResolvedValue(result({ ...pending, id: 2 }));
    state.filters.keyword = 'new';
    state.query();
    await vi.advanceTimersByTimeAsync(0);
    resolve(result({ ...pending, thumb_status: 'failed' }));
    await vi.advanceTimersByTimeAsync(0);
    expect(state.rows.value[0]?.id).toBe(2);
    expect(state.rows.value[0]?.thumb_status).toBe('pending');
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.list).toHaveBeenCalledTimes(4);
    expect(mock.list).toHaveBeenLastCalledWith(1, 20, {
      category: undefined,
      keyword: 'new',
    });
  });

  it('keeps action errors and retries silent request failures within the budget', async () => {
    const state = mount();
    await vi.advanceTimersByTimeAsync(0);
    state.error.value = '复制失败';
    mock.list.mockRejectedValue(new Error('offline'));
    await vi.advanceTimersByTimeAsync(120_000);
    expect(mock.list).toHaveBeenCalledTimes(13);
    expect(state.rows.value[0]?.thumb_status).toBe('pending');
    expect(state.error.value).toBe('复制失败');
    expect(state.loading.value).toBe(false);
  });

  it('cancels pending timers on unmount', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    app.unmount();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('does not restart a timer from a response received after unmount', async () => {
    let resolve!: (value: unknown) => void;
    mock.list.mockReturnValueOnce(new Promise((done) => (resolve = done)));
    mount();
    app.unmount();
    resolve(result());
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stops on cached-page deactivation and reloads on return', async () => {
    mount();
    await vi.advanceTimersByTimeAsync(0);
    visible.value = false;
    await nextTick();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(mock.list).toHaveBeenCalledTimes(1);
    visible.value = true;
    await nextTick();
    await vi.advanceTimersByTimeAsync(5000);
    expect(mock.list).toHaveBeenCalledTimes(3);
  });
});
