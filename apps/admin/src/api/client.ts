import type { RequestClientConfig } from '@vben/request';

import type { ApiEnvelope } from './model/response';

import { CanceledError, isCancel, RequestClient } from '@vben/request';

import { ApiError, toApiError } from './errors';

export interface ApiRequestConfig extends RequestClientConfig {
  authenticated?: boolean;
  /** Invalid submitted credentials must not revoke a valid calling session. */
  credentialCheck?: boolean;
  /** Show verbatim 400/409 business messages for explicitly opted-in requests. */
  preserveBusinessMessage?: boolean;
  silent?: boolean;
  /** Internal replay markers, kept on the original Axios configuration. */
  _accessToken?: null | string;
  _authRetried?: boolean;
  _sessionVersion?: number;
}

export interface AuthenticationHandler {
  getAccessToken: () => null | string;
  getSessionVersion?: () => number;
  onSessionExpired: () => unknown;
  refreshAccessToken: () => Promise<string>;
}

export function createApiClient(
  baseURL: string,
  authentication: AuthenticationHandler,
  notify: (text: string) => void,
  defaultAuthenticated = true,
) {
  const client = new RequestClient({ baseURL });
  const reported = new WeakSet<ApiError>();

  client.addRequestInterceptor({
    fulfilled: (config) => {
      const options = config as ApiRequestConfig & typeof config;
      options.authenticated ??= defaultAuthenticated;
      options._sessionVersion = authentication.getSessionVersion?.() ?? 0;
      options._accessToken = options.authenticated
        ? authentication.getAccessToken()
        : null;
      if (options._accessToken) {
        config.headers.Authorization = `Bearer ${options._accessToken}`;
      } else if (options.authenticated) {
        config.headers.delete('Authorization');
      }
      config.headers['Accept-Language'] = 'zh-CN';
      return config;
    },
  });

  client.addResponseInterceptor({
    fulfilled: (response) => {
      const config = response.config as ApiRequestConfig;
      if (
        config.authenticated &&
        config._sessionVersion !== (authentication.getSessionVersion?.() ?? 0)
      ) {
        throw new CanceledError('登录状态已变更');
      }
      if (response.status === 204) return undefined;
      // Vben's interceptor signature describes raw responses; its unwrapping
      // interceptors intentionally return the payload through this boundary.
      const body = response.data as ApiEnvelope<any>;
      if (body && body.code === 0) return body.data;
      throw new ApiError({
        code: body?.code,
        config: response.config,
        message: body?.message,
        status: response.status,
        traceId: body?.trace_id,
      });
    },
  });

  client.addResponseInterceptor({
    rejected: async (failure: unknown) => {
      if (isCancel(failure)) throw failure;
      const error = toApiError(failure);
      const config = error.config as ApiRequestConfig | undefined;
      if (
        config?.authenticated &&
        config._sessionVersion !== (authentication.getSessionVersion?.() ?? 0)
      ) {
        throw new CanceledError('登录状态已变更');
      }
      if (!config?.authenticated || error.code === 20_109) throw error;
      if (config.credentialCheck && error.code === 20_101) throw error;

      // 20101 and 20103 revoke a session; 20102 is natural access expiry.
      if (error.code === 20_101 || error.code === 20_103) {
        await authentication.onSessionExpired();
        throw error;
      }
      if (error.status !== 401 && error.code !== 20_102) throw error;
      if (config._authRetried) {
        await authentication.onSessionExpired();
        throw error;
      }

      config._authRetried = true;
      try {
        // A delayed 401 may arrive after another request already rotated tokens.
        const current = authentication.getAccessToken();
        if (!current || current === config._accessToken) {
          await authentication.refreshAccessToken();
        }
      } catch (error_) {
        if (isCancel(error_)) throw error_;
        if (
          config._sessionVersion !== (authentication.getSessionVersion?.() ?? 0)
        ) {
          throw new CanceledError('登录状态已变更');
        }
        const refreshError = toApiError(error_);
        if (
          (refreshError.status === 401 && refreshError.code !== 20_109) ||
          [20_101, 20_102, 20_103].includes(refreshError.code ?? 0)
        ) {
          await authentication.onSessionExpired();
        }
        throw refreshError;
      }
      if (
        config._sessionVersion !== (authentication.getSessionVersion?.() ?? 0)
      ) {
        throw new CanceledError('登录状态已变更');
      }
      return client.request(config.url ?? '', config);
    },
  });

  client.addResponseInterceptor({
    rejected: (failure: unknown) => {
      if (isCancel(failure)) throw failure;
      const error = toApiError(failure);
      if (
        !(error.config as ApiRequestConfig | undefined)?.silent &&
        error.code !== 20_109 &&
        !reported.has(error)
      ) {
        reported.add(error);
        notify(error.message);
      }
      throw error;
    },
  });
  return client;
}
