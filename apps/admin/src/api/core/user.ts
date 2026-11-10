import type { UserInfo } from '@vben/types';

import type { Overview } from '#/api/model/identity';

import { requestClient } from '#/api/request';

export async function getUserInfoApi(): Promise<UserInfo> {
  const { user } = await requestClient.get<Overview>('/auth/me');
  return {
    avatar: user.avatar || '',
    desc: '',
    homePath: '',
    realName: user.nickname || user.username,
    roles: (user.roles ?? []).map((role) => role.code),
    token: '',
    userId: String(user.id),
    username: user.username,
  };
}
