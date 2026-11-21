import type { LibraryFile } from '#/api/model/storage';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ApiError } from '#/api/errors';

import { useFilePage } from '../use-file-page';

const mock = vi.hoisted(() => ({
  list: vi.fn(),
  usage: vi.fn(),
  url: vi.fn(),
  success: vi.fn(),
  clipboard: vi.fn(),
  allowed: true,
}));
vi.mock('#/api/core/files', () => ({
  getFilesApi: mock.list,
  getFileUsageApi: mock.usage,
  deleteFileApi: vi.fn(),
  downloadFileApi: vi.fn(),
  getFileUrlApi: mock.url,
}));
vi.mock('ant-design-vue', async (original) => ({
  ...(await original<typeof import('ant-design-vue')>()),
  message: { success: mock.success },
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
  mock.usage
    .mockReset()
    .mockResolvedValue({ used_bytes: 91, quota_bytes: 100, file_count: 2 });
  mock.url.mockReset();
  mock.success.mockReset();
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: {
      writeText: mock.clipboard.mockReset().mockResolvedValue(undefined),
    },
  });
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
    expect(mock.usage).not.toHaveBeenCalled();
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
      { keyword: 'newer', category: undefined },
    ]);
  });

  it('surfaces API errors and resets filters to show the uploaded row', async () => {
    mock.list.mockRejectedValueOnce(new ApiError({ status: 500 }));
    const state = mount();
    await vi.waitFor(() => expect(state.error.value).toContain('服务暂不可用'));
    state.filters.keyword = 'other';
    state.filters.category = 'image';
    state.uploaded({ id: 42 } as LibraryFile);
    expect(state.highlighted.value).toBe(42);
    expect(state.filters.keyword).toBe('');
    expect(state.filters.category).toBeUndefined();
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

  it('sends each category and refreshes quota after upload', async () => {
    const state = mount();
    await vi.waitFor(() => expect(state.usage.value?.file_count).toBe(2));
    expect(state.usagePercent.value).toBe(91);
    for (const category of [
      'image',
      'document',
      'sheet',
      'archive',
      'text',
    ] as const) {
      state.filters.category = category;
      state.query();
      await vi.waitFor(() =>
        expect(mock.list).toHaveBeenLastCalledWith(1, 20, {
          keyword: undefined,
          category,
        }),
      );
    }
    mock.usage.mockResolvedValue({
      used_bytes: 90,
      quota_bytes: 100,
      file_count: 3,
    });
    state.uploaded({ id: 13 } as LibraryFile);
    await vi.waitFor(() => expect(state.usagePercent.value).toBe(90));
  });

  it.each([
    [0, '长期有效'],
    [300, '5 分钟内有效'],
  ])(
    'copies a URL with the correct lifetime for %s seconds',
    async (expires_in, text) => {
      const state = mount();
      mock.url.mockResolvedValue({
        url: 'https://files.example.test/original.png',
        expires_in,
      });
      await state.copy({ id: 1 } as LibraryFile);
      expect(mock.clipboard).toHaveBeenCalledWith(
        'https://files.example.test/original.png',
      );
      expect(mock.success).toHaveBeenCalledWith(`链接已复制，${text}`);
    },
  );

  it('loads the original URL and ignores a late preview after closing', async () => {
    let resolve!: (value: unknown) => void;
    mock.url.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const state = mount();
    const opening = state.preview({ id: 1, category: 'image' } as LibraryFile);
    expect(state.previewFile.value?.id).toBe(1);
    state.closePreview();
    resolve({ url: 'https://files.example.test/old.png', expires_in: 0 });
    await opening;
    expect(state.previewFile.value).toBeUndefined();
    expect(state.previewUrl.value).toBe('');
    mock.url.mockResolvedValue({
      url: 'https://files.example.test/original.png',
      expires_in: 0,
    });
    await state.preview({ id: 2, category: 'image' } as LibraryFile);
    expect(state.previewUrl.value).toBe(
      'https://files.example.test/original.png',
    );
  });
});
