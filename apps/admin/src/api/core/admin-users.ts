import type { ApiRequestConfig } from '#/api/client';
import type { AdminUser, UserListQuery } from '#/api/model/admin-user';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

// Enable after BE-1 supports keyword/status on GET /admin/users.
const USER_FILTERS_ENABLED = false;

export function normalizeUserQuery(query: UserListQuery = {}) {
  return {
    keyword: query.keyword?.trim() || undefined,
    page: Number.isFinite(query.page)
      ? Math.max(1, Math.trunc(query.page!))
      : 1,
    page_size: Number.isFinite(query.page_size)
      ? Math.min(100, Math.max(1, Math.trunc(query.page_size!)))
      : 20,
    status: query.status || undefined,
  };
}

export function getUsersApi(
  query: UserListQuery = {},
  config?: ApiRequestConfig,
) {
  const { keyword, status, ...pagination } = normalizeUserQuery(query);
  return requestClient.get<PageResult<AdminUser>>('/admin/users', {
    ...config,
    params: {
      ...pagination,
      ...(USER_FILTERS_ENABLED ? { keyword, status } : {}),
    },
  });
}
