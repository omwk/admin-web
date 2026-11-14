import type { ApiRequestConfig } from '#/api/client';
import type {
  IdentitySession,
  Overview,
  ProfileInput,
} from '#/api/model/identity';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

const silent: ApiRequestConfig = { silent: true };
const profileWrite: ApiRequestConfig = {
  preserveBusinessMessage: true,
  silent: true,
};
const passwordWrite: ApiRequestConfig = { credentialCheck: true, silent: true };

export const getMySessionsApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<IdentitySession>>('/auth/sessions', {
    ...silent,
    params: { page, page_size: pageSize, sort: '-created_at' },
  });

export const logoutAllApi = () =>
  requestClient.post<undefined>('/auth/logout-all', undefined, silent);

export async function getMyProfileApi() {
  const data = await requestClient.get<Overview>('/auth/me', silent);
  return {
    ...data.user,
    tenant_code: data.tenant_code ?? data.user.tenant_code,
  };
}

export const updateMyProfileApi = (input: ProfileInput) =>
  requestClient.put('/auth/profile', input, profileWrite);

export const changeMyPasswordApi = (input: {
  oldPassword: string;
  newPassword: string;
}) => requestClient.put<undefined>('/auth/password', input, passwordWrite);
