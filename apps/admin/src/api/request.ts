import { useAppConfig } from '@vben/hooks';

import { message } from 'ant-design-vue';

import { refreshAccessToken } from '#/auth/refresh';
import { getAccessToken, getSessionVersion } from '#/auth/token';

import { createApiClient } from './client';

const { apiURL } = useAppConfig(import.meta.env, import.meta.env.PROD);
const baseURL = `${apiURL.replace(/\/$/, '')}/v1`;
const authentication = {
  getAccessToken,
  getSessionVersion,
  onSessionExpired: async () => {
    const { useAuthStore } = await import('#/store');
    await useAuthStore().expireSession();
  },
  refreshAccessToken,
};

export const requestClient = createApiClient(
  baseURL,
  authentication,
  (text) => {
    message.error(text);
  },
);

// Refresh/logout handle their own recovery. Their errors are reported by the
// original authenticated request, once, after refresh coordination completes.
export const baseRequestClient = createApiClient(
  baseURL,
  authentication,
  () => {},
  false,
);
