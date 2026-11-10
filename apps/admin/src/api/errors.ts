import type { RequestClientConfig } from '@vben/request';

const codeMessages: Record<number, string> = {
  10001: '请求参数不正确，请检查后重试',
  10002: '服务暂不可用，请稍后重试',
  10003: '请求的资源不存在',
  10004: '请求处理中，请稍后重试',
  10005: '请求过于频繁，请稍后重试',
  10006: '请求内容已变更，请重新操作',
  10007: '服务响应超时，请稍后重试',
  20101: '登录已失效，请重新登录',
  20102: '登录凭据已过期，请重新登录',
  20103: '登录已失效，请重新登录',
  20104: '账号已锁定，请稍后再试',
  20105: '资源正在使用，暂时无法操作',
  20106: '菜单配置存在循环，请联系管理员',
  20107: '没有权限执行此操作',
  20108: '需要再次验证身份，请联系管理员',
  20109: '登录凭据正在刷新，请稍后重试',
  80201: '该功能暂不可用',
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
  readonly code?: number;
  readonly config?: RequestClientConfig;
  readonly status?: number;
  readonly traceId?: string;

  constructor(
    options: {
      code?: number;
      config?: RequestClientConfig;
      status?: number;
      traceId?: string;
    } = {},
  ) {
    super(getErrorMessage(options.code, options.status));
    this.name = 'ApiError';
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
    response?: { data?: { code?: number; trace_id?: string }; status?: number };
  };
  return new ApiError({
    code: failure?.response?.data?.code,
    config: failure?.config,
    status: failure?.response?.status,
    traceId: failure?.response?.data?.trace_id,
  });
}
