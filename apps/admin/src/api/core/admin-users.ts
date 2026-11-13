import type { ApiRequestConfig } from '#/api/client';
import type {
  AdminUser,
  CreateUserInput,
  UserInput,
  UserListQuery,
} from '#/api/model/admin-user';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

export function normalizeUserQuery(query: UserListQuery = {}) {
  return {
    keyword: query.keyword?.trim() || undefined,
    page: Number.isFinite(query.page)
      ? Math.max(1, Math.trunc(query.page ?? 0))
      : 1,
    page_size: Number.isFinite(query.page_size)
      ? Math.min(100, Math.max(1, Math.trunc(query.page_size ?? 0)))
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

const writeConfig: ApiRequestConfig = { silent: true };
export const getUserApi = (id: number) =>
  requestClient.get<AdminUser>(`/admin/users/${id}`, writeConfig);
export const createUserApi = (input: CreateUserInput) =>
  requestClient.post<AdminUser>('/admin/users', input, writeConfig);
export const updateUserApi = (id: number, input: UserInput) =>
  requestClient.put<AdminUser>(`/admin/users/${id}`, input, writeConfig);
export const deleteUserApi = (id: number) =>
  requestClient.delete(`/admin/users/${id}`, writeConfig);
export const unlockUserApi = (id: number) =>
  requestClient.post<AdminUser>(
    `/admin/users/${id}/unlock`,
    undefined,
    writeConfig,
  );
export const getUserRolesApi = (id: number) =>
  requestClient.get<number[]>(`/admin/users/${id}/roles`, writeConfig);
export const setUserRolesApi = (id: number, roleIds: number[]) =>
  requestClient.put(
    `/admin/users/${id}/roles`,
    { role_ids: roleIds },
    writeConfig,
  );
export const resetUserPasswordApi = (id: number, password: string) =>
  requestClient.post(
    `/admin/users/${id}/reset-password`,
    { password },
    writeConfig,
  );
export const createResetLinkApi = (id: number) =>
  requestClient.post<{ link: string }>(
    `/admin/users/${id}/reset-link`,
    undefined,
    writeConfig,
  );
