import type { AxiosResponse, InternalAxiosRequestConfig } from '@vben/request';

import { AxiosError } from '@vben/request';

export function envelope<T>(data: T, code = 0) {
  return {
    code,
    data,
    message: 'BACKEND_PRIVATE_MESSAGE',
    trace_id: 'trace-test',
  };
}

export function respond(
  config: InternalAxiosRequestConfig,
  data: unknown,
  status = 200,
): Promise<AxiosResponse> {
  const response = {
    config,
    data,
    headers: {},
    status,
    statusText: String(status),
  };
  return status >= 400
    ? Promise.reject(
        new AxiosError(
          'BACKEND_PRIVATE_MESSAGE',
          undefined,
          config,
          undefined,
          response,
        ),
      )
    : Promise.resolve(response);
}
