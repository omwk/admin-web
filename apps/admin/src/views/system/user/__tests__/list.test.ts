import type { AdminUser } from '#/api/model/admin-user';
import type { PageResult } from '#/api/model/response';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getUsersApi } from '#/api/core/admin-users';
import { ApiError } from '#/api/errors';
import { formatDateTime } from '#/utils/datetime';

import { useUserList } from '../use-user-list';

vi.mock('#/api/core/admin-users', async (original) => {
  const api = await original<typeof import('#/api/core/admin-users')>();
  return { ...api, getUsersApi: vi.fn() };
});
vi.mock('#/api/request', () => ({ requestClient: {} }));
const request = vi.mocked(getUsersApi);
const result: PageResult<AdminUser> = {
  list: [],
  page: 1,
  page_size: 20,
  total: 35,
};

beforeEach(() => {
  request.mockReset();
  request.mockResolvedValue(result);
});

describe('user list state', () => {
  it('resets pagination on keyword/status changes, retains filters for later pages, and resets both filters', async () => {
    const list = useUserList();
    list.page.value = 3;
    list.keyword.value = '  alice  ';
    list.status.value = 'locked';
    await list.search();
    expect(request).toHaveBeenLastCalledWith({
      keyword: 'alice',
      page: 1,
      page_size: 20,
      status: 'locked',
    });
    request.mockResolvedValueOnce({ ...result, page: 2 });
    await list.changePage(2, 20);
    expect(request).toHaveBeenLastCalledWith({
      keyword: 'alice',
      page: 2,
      page_size: 20,
      status: 'locked',
    });
    await list.reset();
    expect(request).toHaveBeenLastCalledWith({
      keyword: '',
      page: 1,
      page_size: 20,
      status: undefined,
    });
    expect(list.loading.value).toBe(false);
  });

  it('caps page size and restarts at page one when the size changes', async () => {
    const list = useUserList();
    request.mockResolvedValueOnce({ ...result, page_size: 100 });
    await list.changePage(4, 200);
    expect(request).toHaveBeenLastCalledWith({
      keyword: '',
      page: 1,
      page_size: 100,
    });
    expect(list.pageSize.value).toBe(100);
  });

  it('ignores stale responses when filters race or a view is destroyed', async () => {
    let finish!: (page: PageResult<AdminUser>) => void;
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const list = useUserList();
    const first = list.load();
    request.mockResolvedValueOnce({ ...result, total: 2 });
    await list.search();
    finish({ ...result, total: 99 });
    await first;
    expect(list.total.value).toBe(2);
    request.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const destroyed = list.load();
    list.dispose();
    finish({ ...result, total: 100 });
    await destroyed;
    expect(list.total.value).toBe(2);
  });

  it('renders only locally mapped error text and can retry successfully', async () => {
    request.mockRejectedValueOnce(new ApiError({ code: 20_107, status: 403 }));
    const list = useUserList();
    await list.load();
    expect(list.error.value).toBe('没有权限执行此操作');
    expect(list.loading.value).toBe(false);
    await list.load();
    expect(list.error.value).toBe('');
    expect(list.total.value).toBe(35);
  });
});

describe('rFC3339 UTC rendering', () => {
  it('converts UTC and equivalent offsets to the same local display', () => {
    const instant = '2026-11-10T08:00:00Z';
    const date = new Date(instant);
    const pad = (n: number) => String(n).padStart(2, '0');
    const expected = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:00:00`;
    expect(formatDateTime(instant)).toBe(expected);
    expect(formatDateTime('2026-11-10T16:00:00+08:00')).toBe(expected);
    expect(formatDateTime('invalid')).toBe('—');
    expect(formatDateTime(null)).toBe('—');
  });
});
