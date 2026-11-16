export type LogResult = 'failure' | 'success';
export type JsonValue =
  | boolean
  | JsonValue[]
  | null
  | number
  | string
  | { [key: string]: JsonValue };

export interface AuditLog {
  id: number;
  actor_type: 'api_client' | 'system' | 'user';
  actor_id: null | number;
  actor_name?: null | string;
  actor_tenant_name?: null | string;
  action: string;
  resource_type: string;
  resource_id: string;
  resource_label?: null | string;
  before: JsonValue;
  after: JsonValue;
  ip: string;
  user_agent: string;
  trace_id: string;
  result: LogResult;
  error_code?: null | number;
  error_message?: null | string;
  created_at: string;
  truncated: boolean;
}

export interface LoginLog {
  id: number;
  user_id: null | number;
  username: string;
  resource_id: string;
  result: LogResult;
  ip: string;
  user_agent: string;
  created_at: string;
}

interface LogQuery {
  result?: LogResult;
  from?: string;
  to?: string;
  page: number;
  page_size: number;
}
export interface AuditLogQuery extends LogQuery {
  keyword?: string;
  actor_name?: string;
  action_prefix?: string;
  actor_id?: number;
  action?: string;
  resource_type?: string;
}
export interface LoginLogQuery extends LogQuery {
  user_id?: number;
}
