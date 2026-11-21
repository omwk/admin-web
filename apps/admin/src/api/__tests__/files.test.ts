import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getFilesApi, getFileUsageApi, uploadFileApi } from '../core/files';

const calls = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('#/api/request', () => ({ requestClient: calls }));
beforeEach(() => vi.clearAllMocks());
describe('file library contracts', () => {
  it('forwards category and pagination while usage has its own endpoint', async () => {
    await getFilesApi(2, 50, { category: 'image', keyword: 'photo' });
    expect(calls.get).toHaveBeenCalledWith(
      '/admin/files',
      expect.objectContaining({
        params: { page: 2, page_size: 50, category: 'image', keyword: 'photo' },
      }),
    );
    await getFileUsageApi();
    expect(calls.get).toHaveBeenLastCalledWith(
      '/admin/files/usage',
      expect.objectContaining({ silent: true }),
    );
  });
  it('uploads only file bytes and leaves multipart boundaries to the browser', async () => {
    const file = new File(['original'], 'notes.txt', { type: 'text/plain' });
    const progress = vi.fn();
    await uploadFileApi(file, progress);
    const [path, data, config] = calls.post.mock.lastCall ?? [];
    expect(path).toBe('/admin/files');
    expect(data.get('file')).toBe(file);
    expect([...data.keys()]).toEqual(['file']);
    expect(config.headers['Content-Type']).toBeUndefined();
    config.onUploadProgress({ loaded: 10, total: 10 });
    expect(progress).toHaveBeenCalledWith(99);
  });
});
