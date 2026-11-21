import type { IdentityUser } from '#/api/model/identity';

import { useAppConfig } from '@vben/hooks';

export function avatarUrl(
  user: Pick<IdentityUser, 'avatar' | 'id'>,
  version: number | string = Date.now(),
) {
  if (!user.avatar) return '';
  const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
  return `${apiURL.replace(/\/$/, '')}/v1/avatars/${user.id}?v=${encodeURIComponent(version)}`;
}
