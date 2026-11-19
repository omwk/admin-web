import type { ApiRequestConfig } from '#/api/client';
import type {
  IdentitySession,
  IdentityUser,
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
const emailVerify: ApiRequestConfig = { ...profileWrite, authenticated: false };
const passwordWrite: ApiRequestConfig = { credentialCheck: true, silent: true };

export const getMySessionsApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<IdentitySession>>('/auth/sessions', {
    ...silent,
    params: { page, page_size: pageSize, sort: '-created_at' },
  });

export const logoutAllApi = () =>
  requestClient.post<undefined>('/auth/logout-all', undefined, silent);

export const logoutOthersApi = () =>
  requestClient.post<{ revoked: number }>(
    '/auth/logout-others',
    undefined,
    silent,
  );

export const revokeMySessionApi = (sid: string) =>
  requestClient.delete<undefined>(
    `/auth/sessions/${encodeURIComponent(sid)}`,
    silent,
  );

export async function getMyProfileApi() {
  const data = await requestClient.get<Overview>('/auth/me', silent);
  return {
    ...data.user,
    tenant_code: data.tenant_code ?? data.user.tenant_code,
  };
}

export const updateMyProfileApi = (input: ProfileInput) =>
  requestClient.put<
    Pick<IdentityUser, 'avatar' | 'email' | 'nickname' | 'phone'>
  >('/auth/profile', input, profileWrite);

export const changeMyEmailApi = (email: string) =>
  requestClient.post<{ pending: boolean; expires_in_hours: number }>(
    '/auth/profile/email/change',
    { email },
    profileWrite,
  );

export const verifyMyEmailApi = (token: string) =>
  requestClient.post<{ email: string }>(
    '/auth/profile/email/verify',
    { token },
    emailVerify,
  );

export const changeMyPasswordApi = (input: {
  oldPassword: string;
  newPassword: string;
}) => requestClient.put<undefined>('/auth/password', input, passwordWrite);
