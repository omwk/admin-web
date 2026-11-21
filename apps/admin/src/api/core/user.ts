import type { UserInfo } from '@vben/types';

import type { IdentityUser, Overview } from '#/api/model/identity';

import { requestClient } from '#/api/request';
import { avatarUrl } from '#/utils/avatar';

export async function getUserInfoApi(): Promise<UserInfo> {
  const data = await requestClient.get<Overview>('/auth/me');
  return toUserInfo({
    ...data.user,
    tenant_code: data.tenant_code ?? data.user.tenant_code,
  });
}

export function toUserInfo(user: IdentityUser): UserInfo {
  return {
    avatar: avatarUrl(user),
    desc: '',
    homePath: '/home',
    isSuper: user.is_super,
    tenantId: user.tenant_id,
    tenantCode: user.tenant_code || '',
    realName: user.nickname || user.username,
    roles: (user.roles ?? []).map((role) => role.code),
    token: '',
    userId: String(user.id),
    username: user.username,
  };
}
