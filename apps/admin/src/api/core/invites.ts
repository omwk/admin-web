import type { ApiRequestConfig } from '#/api/client';
import type {
  AcceptInviteInput,
  Invite,
  InviteInput,
} from '#/api/model/invite';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

const silent: ApiRequestConfig = { silent: true };
const anonymous: ApiRequestConfig = { authenticated: false, silent: true };
export const getInvitesApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<Invite>>('/admin/invites', {
    ...silent,
    params: { page, page_size: pageSize },
  });
export const createInviteApi = (input: InviteInput) =>
  requestClient.post<Invite>('/admin/invites', input, silent);
export const revokeInviteApi = (id: number) =>
  requestClient.delete(`/admin/invites/${id}`, silent);
export const acceptInviteApi = (input: AcceptInviteInput) =>
  requestClient.post<{ id: number; username: string }>(
    '/auth/invite/accept',
    input,
    anonymous,
  );
export const consumeResetLinkApi = (input: {
  newPassword: string;
  tenant_id: number;
  token: string;
}) => requestClient.post('/auth/password/reset', input, anonymous);
