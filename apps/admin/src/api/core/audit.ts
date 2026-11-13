import type { ApiRequestConfig } from '#/api/client';
import type {
  AuditLog,
  AuditLogQuery,
  LoginLog,
  LoginLogQuery,
} from '#/api/model/audit';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

const silent: ApiRequestConfig = { silent: true };

export const getAuditLogsApi = (params: AuditLogQuery) =>
  requestClient.get<PageResult<AuditLog>>('/admin/audit-logs', {
    ...silent,
    params,
  });

export const getLoginLogsApi = (params: LoginLogQuery) =>
  requestClient.get<PageResult<LoginLog>>('/admin/login-logs', {
    ...silent,
    params,
  });
