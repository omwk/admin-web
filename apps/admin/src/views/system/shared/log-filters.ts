import type { Dayjs } from 'dayjs';

import type { LogResult } from '#/api/model/audit';

export interface LogFilters {
  identity?: null | number;
  action?: string;
  resourceType?: string;
  result?: LogResult;
  range?: [Dayjs, Dayjs] | null;
}

export const logResults = [
  { label: '成功', value: 'success' },
  { label: '失败', value: 'failure' },
];

function commonQuery(filters: LogFilters) {
  return {
    result: filters.result || undefined,
    from: filters.range?.[0].toISOString(),
    to: filters.range?.[1].toISOString(),
  };
}
export function auditQuery(filters: LogFilters) {
  return {
    ...commonQuery(filters),
    actor_id: filters.identity ?? undefined,
    action: filters.action?.trim() || undefined,
    resource_type: filters.resourceType?.trim() || undefined,
  };
}
export function loginQuery(filters: LogFilters) {
  return { ...commonQuery(filters), user_id: filters.identity ?? undefined };
}
