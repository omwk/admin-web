import type { TokenPair } from '#/api/model/identity';

import { CanceledError } from '@vben/request';

import { refreshTokenApi } from '#/api/core/auth';
import { ApiError, toApiError } from '#/api/errors';

import { getRefreshToken, getSessionVersion, setTokens } from './token';

interface RefreshDependencies {
  delay?: (milliseconds: number) => Promise<void>;
  getRefreshToken: () => null | string;
  getSessionVersion: () => number;
  onSessionExpired: () => unknown;
  request: (refreshToken: string) => Promise<TokenPair>;
  setTokens: (pair: TokenPair) => void;
}

export function createRefreshCoordinator(dependencies: RefreshDependencies) {
  let pending: Promise<string> | undefined;
  let pendingVersion: number | undefined;
  const delay =
    dependencies.delay ??
    ((milliseconds) =>
      new Promise<void>((resolve) => {
        setTimeout(resolve, milliseconds);
      }));

  return function refreshAccessToken(): Promise<string> {
    const version = dependencies.getSessionVersion();
    if (pending && pendingVersion === version) return pending;

    const assertCurrentSession = () => {
      if (version !== dependencies.getSessionVersion()) {
        throw new CanceledError('登录状态已变更');
      }
    };
    const rotate = async () => {
      for (let attempt = 0; attempt < 5; attempt++) {
        assertCurrentSession();
        const token = dependencies.getRefreshToken();
        if (!token) {
          await dependencies.onSessionExpired();
          throw new ApiError({ code: 20_101, status: 401 });
        }
        try {
          const pair = await dependencies.request(token);
          assertCurrentSession();
          dependencies.setTokens(pair);
          return pair.access_token;
        } catch (error_) {
          assertCurrentSession();
          const error = toApiError(error_);
          if (error.code === 20_109 && attempt < 4) {
            await delay(400 * 2 ** attempt);
            continue;
          }
          if (
            [20_101, 20_102, 20_103].includes(error.code ?? 0) ||
            (error.status === 401 && error.code !== 20_109)
          ) {
            await dependencies.onSessionExpired();
          }
          throw error;
        }
      }
      throw new ApiError({ code: 20_109 });
    };

    pendingVersion = version;
    const operation = rotate().finally(() => {
      if (pending === operation) {
        pending = undefined;
        pendingVersion = undefined;
      }
    });
    pending = operation;
    return operation;
  };
}

export const refreshAccessToken = createRefreshCoordinator({
  getRefreshToken,
  getSessionVersion,
  onSessionExpired: async () => {
    const { useAuthStore } = await import('#/store');
    await useAuthStore().expireSession();
  },
  request: (token) => refreshTokenApi(token),
  setTokens,
});
