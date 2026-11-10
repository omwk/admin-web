import type { ApiRequestConfig } from '#/api/client';
import type {
  LoginParams as IdentityLoginParams,
  LoginData,
  TokenPair,
} from '#/api/model/identity';

import { baseRequestClient, requestClient } from '#/api/request';

export namespace AuthApi {
  export type LoginParams = IdentityLoginParams;
  export type LoginResult = LoginData;
  export type RefreshTokenResult = TokenPair;
}

const publicRequest: ApiRequestConfig = { authenticated: false };

export function loginApi(data: IdentityLoginParams) {
  return requestClient.post<LoginData>('/auth/login', data, publicRequest);
}

export function refreshTokenApi(refreshToken: string) {
  return baseRequestClient.post<TokenPair>('/auth/refresh', {
    refresh_token: refreshToken,
  });
}

/** Use a captured Bearer so local logout can invalidate memory immediately. */
export function logoutApi(accessToken: string) {
  return baseRequestClient.post<void>('/auth/logout', undefined, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}
