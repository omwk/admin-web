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
  action: string;
  resource_type: string;
  resource_id: string;
  before: JsonValue;
  after: JsonValue;
  ip: string;
  user_agent: string;
  trace_id: string;
  result: LogResult;
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
  actor_id?: number;
  action?: string;
  resource_type?: string;
}
export interface LoginLogQuery extends LogQuery {
  user_id?: number;
}
