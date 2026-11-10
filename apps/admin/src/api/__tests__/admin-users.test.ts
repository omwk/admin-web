import { describe, expect, it, vi } from 'vitest';

import { getUsersApi, normalizeUserQuery } from '../core/admin-users';

const get = vi.hoisted(() =>
  vi.fn(async (_path: string, config: { params: unknown }) => ({
    list: [],
    page: 1,
    page_size: 100,
    total: 0,
    query: config.params,
  })),
);
vi.mock('#/api/request', () => ({ requestClient: { get } }));

describe('read-only users API', () => {
  it('omits unsupported filters at the API boundary and caps page size at 100', async () => {
    await getUsersApi({
      keyword: '  alice  ',
      page: 2,
      page_size: 200,
      status: 'active',
    });
    expect(get).toHaveBeenCalledWith('/admin/users', {
      params: { page: 2, page_size: 100 },
    });
  });

  it('omits empty filters and normalizes invalid pagination', () => {
    expect(normalizeUserQuery()).toEqual({
      keyword: undefined,
      page: 1,
      page_size: 20,
      status: undefined,
    });
    expect(
      normalizeUserQuery({ page: -4, page_size: 0, status: '' }),
    ).toMatchObject({ page: 1, page_size: 1, status: undefined });
    expect(
      normalizeUserQuery({
        page: Number.NaN,
        page_size: Number.POSITIVE_INFINITY,
      }),
    ).toMatchObject({ page: 1, page_size: 20 });
  });
});
