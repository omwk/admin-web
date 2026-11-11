import { describe, expect, it, vi } from 'vitest';

import { getAllRolesApi } from '../core/system';

const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/request', () => ({ requestClient: { get } }));

describe('role selectors', () => {
  it('loads beyond 100 roles so existing assignments are not silently lost', async () => {
    get.mockResolvedValueOnce({
      list: Array.from({ length: 100 }, (_, id) => ({ id: id + 1 })),
      total: 101,
    });
    get.mockResolvedValueOnce({ list: [{ id: 101 }], total: 101 });
    const roles = await getAllRolesApi();
    expect(roles).toHaveLength(101);
    expect(roles.at(-1)?.id).toBe(101);
    expect(get).toHaveBeenNthCalledWith(2, '/admin/roles', {
      silent: true,
      params: { page: 2, page_size: 100 },
    });
  });
});
