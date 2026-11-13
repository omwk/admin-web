import type { RequestClientConfig } from '@vben/request';

const codeMessages: Record<number, string> = {
  10_001: '请求参数不正确，请检查后重试',
  10_002: '服务暂不可用，请稍后重试',
  10_003: '请求的资源不存在',
  10_004: '请求处理中，请稍后重试',
  10_005: '请求过于频繁，请稍后重试',
  10_006: '请求内容已变更，请重新操作',
  10_007: '服务响应超时，请稍后重试',
  20_101: '登录已失效，请重新登录',
  20_102: '登录凭据已过期，请重新登录',
  20_103: '登录已失效，请重新登录',
  20_104: '账号已锁定，请稍后再试',
  20_105: '资源正在使用，暂时无法操作',
  20_106: '菜单配置存在循环，请联系管理员',
  20_107: '没有权限执行此操作',
  20_108: '需要再次验证身份，请联系管理员',
  20_109: '登录凭据正在刷新，请稍后重试',
  80_201: '该功能暂不可用',
};

const statusMessages: Record<number, string> = {
  400: '请求参数不正确，请检查后重试',
  401: '登录已失效，请重新登录',
  403: '没有权限执行此操作',
  404: '请求的资源不存在',
  408: '请求超时，请稍后重试',
  409: '数据冲突，请刷新后重试',
  423: '账号已锁定，请稍后再试',
  429: '请求过于频繁，请稍后重试',
  500: '服务暂不可用，请稍后重试',
  503: '服务暂不可用，请稍后重试',
};

export function getErrorMessage(code?: number, status?: number): string {
  return (
    (code === undefined ? undefined : codeMessages[code]) ??
    (status === undefined ? undefined : statusMessages[status]) ??
    '请求失败，请检查网络或稍后重试'
  );
}

export class ApiError extends Error {
  readonly businessMessage?: string;
  readonly code?: number;
  readonly config?: RequestClientConfig;
  readonly status?: number;
  readonly traceId?: string;

  constructor(
    options: {
      code?: number;
      config?: RequestClientConfig;
      message?: string;
      status?: number;
      traceId?: string;
    } = {},
  ) {
    const preserve = (
      options.config as
        | (RequestClientConfig & { preserveBusinessMessage?: boolean })
        | undefined
    )?.preserveBusinessMessage;
    super(
      preserve &&
        [400, 409].includes(options.status ?? 0) &&
        typeof options.message === 'string' &&
        options.message.length > 0
        ? options.message
        : getErrorMessage(options.code, options.status),
    );
    this.name = 'ApiError';
    this.businessMessage = options.message;
    this.code = options.code;
    this.config = options.config;
    this.status = options.status;
    this.traceId = options.traceId;
  }
}

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  const failure = error as null | {
    config?: RequestClientConfig;
    response?: {
      data?: { code?: number; message?: string; trace_id?: string };
      status?: number;
    };
  };
  return new ApiError({
    code: failure?.response?.data?.code,
    config: failure?.config,
    message: failure?.response?.data?.message,
    status: failure?.response?.status,
    traceId: failure?.response?.data?.trace_id,
  });
}
