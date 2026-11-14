import type { ApiRequestConfig } from '#/api/client';
import type { PageResult } from '#/api/model/response';
import type {
  Tenant,
  TenantAdminInviteResult,
  TenantMember,
  TenantProvision,
  TenantProvisionResult,
  TenantTemplate,
  TenantTemplateInput,
} from '#/api/model/tenant';

import { requestClient } from '#/api/request';

const options: ApiRequestConfig = {
  silent: true,
  preserveBusinessMessage: true,
};

export const getTenantsApi = (page = 1, pageSize = 100) =>
  requestClient.get<PageResult<Tenant>>('/admin/tenants', {
    ...options,
    params: { page, page_size: pageSize },
  });
export const getTenantApi = (id: number) =>
  requestClient.get<Tenant>(`/admin/tenants/${id}`, options);
export const getTenantMembersApi = (id: number, page = 1, pageSize = 20) =>
  requestClient.get<PageResult<TenantMember>>(`/admin/tenants/${id}/members`, {
    ...options,
    params: { page, page_size: pageSize },
  });
export const reissueTenantAdminInviteApi = (id: number, force = false) =>
  requestClient.post<TenantAdminInviteResult>(
    `/admin/tenants/${id}/admin-invite`,
    undefined,
    { ...options, ...(force ? { params: { force: true } } : {}) },
  );
export const renameTenantApi = (id: number, input: { name: string }) =>
  requestClient.put<Tenant>(`/admin/tenants/${id}`, input, options);
export const disableTenantApi = (id: number) =>
  requestClient.post<Tenant>(
    `/admin/tenants/${id}/disable`,
    undefined,
    options,
  );
export const enableTenantApi = (id: number) =>
  requestClient.post<Tenant>(`/admin/tenants/${id}/enable`, undefined, options);
export const provisionTenantApi = (input: TenantProvision) =>
  requestClient.post<TenantProvisionResult>('/admin/tenants', input, options);
export const getTenantTemplatesApi = (page = 1, pageSize = 100) =>
  requestClient.get<PageResult<TenantTemplate>>('/admin/tenant-templates', {
    ...options,
    params: { page, page_size: pageSize },
  });
export const getTenantTemplateApi = (id: number) =>
  requestClient.get<TenantTemplate>(`/admin/tenant-templates/${id}`, options);
export const createTenantTemplateApi = (input: TenantTemplateInput) =>
  requestClient.post<TenantTemplate>('/admin/tenant-templates', input, options);
export const updateTenantTemplateApi = (
  id: number,
  input: { description: string; name: string },
) =>
  requestClient.put<TenantTemplate>(
    `/admin/tenant-templates/${id}`,
    input,
    options,
  );
export const deleteTenantTemplateApi = (id: number) =>
  requestClient.delete(`/admin/tenant-templates/${id}`, options);

async function collectPages<T>(
  getPage: (page: number) => Promise<PageResult<T>>,
) {
  const list: T[] = [];
  for (let page = 1; ; page++) {
    const result = await getPage(page);
    list.push(...result.list);
    if (result.list.length === 0 || list.length >= result.total) return list;
  }
}
export const getAllTenantsApi = () => collectPages(getTenantsApi);
export const getAllTenantTemplatesApi = () =>
  collectPages(getTenantTemplatesApi);
