import type { ApiRequestConfig } from '#/api/client';
import type { PageResult } from '#/api/model/response';
import type {
  AdminMenu,
  AdminRole,
  Department,
  MenuInput,
  PermissionGroups,
  RoleInput,
} from '#/api/model/system';

import { requestClient } from '#/api/request';

const silent: ApiRequestConfig = { silent: true };
export const getDepartmentsApi = () =>
  requestClient.get<Department[]>('/admin/depts', silent);
export const getRolesApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<AdminRole>>('/admin/roles', {
    ...silent,
    params: { page, page_size: pageSize },
  });

/** Selectors must include every role, not just the first page. */
export async function getAllRolesApi() {
  const roles: AdminRole[] = [];
  for (let page = 1; ; page++) {
    const result = await getRolesApi(page, 100);
    roles.push(...result.list);
    if (roles.length >= result.total || result.list.length === 0) return roles;
  }
}

export const getRoleApi = (id: number) =>
  requestClient.get<AdminRole>(`/admin/roles/${id}`, silent);
export const createRoleApi = (input: RoleInput) =>
  requestClient.post<AdminRole>('/admin/roles', input, silent);
export const updateRoleApi = (id: number, input: RoleInput) =>
  requestClient.put<AdminRole>(`/admin/roles/${id}`, input, silent);
export const deleteRoleApi = (id: number) =>
  requestClient.delete(`/admin/roles/${id}`, silent);
export type RoleLink = 'depts' | 'menus' | 'permissions';
const relationFields = {
  depts: 'dept_ids',
  menus: 'menu_ids',
  permissions: 'permission_ids',
};
export const getRoleLinksApi = (id: number, relation: RoleLink) =>
  requestClient.get<number[]>(`/admin/roles/${id}/${relation}`, silent);
export const setRoleLinksApi = (
  id: number,
  relation: RoleLink,
  ids: number[],
) =>
  requestClient.put(
    `/admin/roles/${id}/${relation}`,
    { [relationFields[relation]]: ids },
    silent,
  );
export const getPermissionsApi = () =>
  requestClient.get<PermissionGroups>('/admin/permissions', silent);
export const getAdminMenusApi = () =>
  requestClient.get<AdminMenu[]>('/admin/menus', silent);
export const getAdminMenuApi = (id: number) =>
  requestClient.get<AdminMenu>(`/admin/menus/${id}`, silent);
export const createAdminMenuApi = (input: MenuInput) =>
  requestClient.post<AdminMenu>('/admin/menus', input, silent);
export const updateAdminMenuApi = (id: number, input: MenuInput) =>
  requestClient.put<AdminMenu>(`/admin/menus/${id}`, input, silent);
export const deleteAdminMenuApi = (id: number) =>
  requestClient.delete(`/admin/menus/${id}`, silent);
