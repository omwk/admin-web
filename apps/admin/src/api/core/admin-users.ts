import type { ApiRequestConfig } from '#/api/client';
import type { AdminUser, UserListQuery } from '#/api/model/admin-user';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

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
  return requestClient.get<PageResult<AdminUser>>('/admin/users', {
    ...config,
    params: normalizeUserQuery(query),
  });
}
