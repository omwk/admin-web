import type { TokenPair } from '#/api/model/identity';

import { ApiError } from '#/api/errors';

export const REFRESH_TOKEN_KEY = `${import.meta.env.VITE_APP_NAMESPACE || 'admin-web'}:refresh_token`;

let accessToken: null | string = null;
let sessionVersion = 0;

export function getAccessToken() {
  return accessToken;
}

export function getRefreshToken(): null | string {
  try {
    return sessionStorage.getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function getSessionVersion() {
  return sessionVersion;
}

export function setTokens(pair: TokenPair) {
  if (
    !pair.access_token ||
    !pair.refresh_token ||
    pair.token_type !== 'Bearer' ||
    !(pair.expires_in > 0)
  ) {
    throw new ApiError({ code: 10_002 });
  }
  try {
    sessionStorage.setItem(REFRESH_TOKEN_KEY, pair.refresh_token);
  } catch {
    throw new ApiError();
  }
  accessToken = pair.access_token;
}

export function clearTokens() {
  sessionVersion++;
  accessToken = null;
  try {
    sessionStorage.removeItem(REFRESH_TOKEN_KEY);
  } catch {
    // Storage can be unavailable; in-memory credentials still expire.
  }
}
