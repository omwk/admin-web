import type { LibraryFile } from '#/api/model/storage';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import { useFilePage } from '../use-file-page';

const mock = vi.hoisted(() => ({ list: vi.fn(), allowed: true }));
vi.mock('#/api/core/files', () => ({
  getFilesApi: mock.list,
  deleteFileApi: vi.fn(),
  downloadFileApi: vi.fn(),
  getFileUrlApi: vi.fn(),
}));
vi.mock('#/auth/permission', () => ({ hasPermission: () => mock.allowed }));
let app: ReturnType<typeof createApp>;
let container: HTMLDivElement;
function mount() {
  let state!: ReturnType<typeof useFilePage>;
  container = document.createElement('div');
  document.body.append(container);
  app = createApp({
    setup() {
      state = useFilePage();
      return () => null;
    },
  });
  app.mount(container);
  return state;
}
beforeEach(() => {
  mock.allowed = true;
  mock.list.mockReset().mockResolvedValue({ list: [], total: 0 });
});
afterEach(() => {
  app?.unmount();
  container?.remove();
});

describe('file page state', () => {
  it('does not request protected data without permission', async () => {
    mock.allowed = false;
    const state = mount();
    await nextTick();
    expect(state.allowed.value).toBe(false);
    expect(mock.list).not.toHaveBeenCalled();
  });

  it('ignores a late list result after a newer request has completed', async () => {
    let resolve!: (value: unknown) => void;
    mock.list.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const state = mount();
    state.filters.keyword = ' newer ';
    state.query();
    await vi.waitFor(() => expect(mock.list).toHaveBeenCalledTimes(2));
    resolve({ list: [{ id: 10 }], total: 1 });
    await nextTick();
    expect(state.rows.value).toEqual([]);
    expect(mock.list.mock.calls[1]).toEqual([
      1,
      20,
      { keyword: 'newer', purpose: undefined },
    ]);
  });

  it('surfaces API errors and resets filters to show the uploaded row', async () => {
    mock.list.mockRejectedValueOnce(new ApiError({ status: 500 }));
    const state = mount();
    await vi.waitFor(() => expect(state.error.value).toContain('服务暂不可用'));
    state.filters.keyword = 'other';
    state.filters.purpose = 'shop';
    state.uploaded({ id: 42 } as LibraryFile);
    expect(state.highlighted.value).toBe(42);
    expect(state.filters.keyword).toBe('');
    expect(state.filters.purpose).toBeUndefined();
    await vi.waitFor(() => expect(state.error.value).toBe(''));
  });

  it('returns to the previous nonempty page after deleting the final page row', async () => {
    const state = mount();
    await nextTick();
    mock.list
      .mockResolvedValueOnce({ list: [], total: 20 })
      .mockResolvedValueOnce({ list: [{ id: 1 }], total: 20 });
    state.changePage({ current: 2, pageSize: 20 });
    await vi.waitFor(() => expect(state.rows.value).toHaveLength(1));
    expect(state.pagination.current).toBe(1);
  });
});
