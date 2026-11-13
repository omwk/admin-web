import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  createDepartmentApi,
  deleteDepartmentApi,
  getAllRolesApi,
  getDepartmentApi,
  getDepartmentsApi,
  updateDepartmentApi,
} from '../core/system';

const get = vi.hoisted(() => vi.fn());
const writes = vi.hoisted(() => ({
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
}));
vi.mock('#/api/request', () => ({ requestClient: { get, ...writes } }));

beforeEach(() => vi.clearAllMocks());

describe('department requests', () => {
  it('uses the documented endpoints and opts writes into verbatim business messages', async () => {
    const input = {
      parent_id: 1,
      name: '商品组',
      sort: 0,
      status: 'active' as const,
    };
    const config = { silent: true, preserveBusinessMessage: true };
    await getDepartmentsApi();
    await getDepartmentApi(5);
    await createDepartmentApi(input);
    await updateDepartmentApi(5, input);
    await deleteDepartmentApi(5);
    expect(get).toHaveBeenCalledWith('/admin/depts', { silent: true });
    expect(get).toHaveBeenCalledWith('/admin/depts/5', { silent: true });
    expect(writes.post).toHaveBeenCalledWith('/admin/depts', input, config);
    expect(writes.put).toHaveBeenCalledWith('/admin/depts/5', input, config);
    expect(writes.delete).toHaveBeenCalledWith('/admin/depts/5', config);
  });
});

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
