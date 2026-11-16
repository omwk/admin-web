import type { Dayjs } from 'dayjs';

import type { LogResult } from '#/api/model/audit';

export interface LogFilters {
  keyword?: string;
  actionPrefix?: string;
  identity?: null | number;
  action?: string;
  resourceType?: string;
  result?: LogResult;
  range?: [Dayjs, Dayjs] | null;
}

export const auditModules = [
  { label: '身份', value: 'identity.' },
  { label: '租户', value: 'system.tenant.' },
  { label: '字典', value: 'system.dict.' },
  { label: '系统', value: 'system.' },
  { label: '通知', value: 'notification.' },
  { label: '同步', value: 'sync.' },
  { label: '计费', value: 'billing.' },
  { label: '网关', value: 'gateway.' },
  { label: '订单', value: 'order.' },
  { label: '分享', value: 'share.' },
  { label: '店铺', value: 'shop.' },
  { label: '贸易', value: 'trade.' },
  { label: '权限', value: 'permissions.' },
];

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
    keyword: filters.keyword?.trim() || undefined,
    action_prefix: filters.actionPrefix?.trim() || undefined,
    actor_id: filters.identity ?? undefined,
    action: filters.action?.trim() || undefined,
    resource_type: filters.resourceType?.trim() || undefined,
  };
}
export function loginQuery(filters: LogFilters) {
  return { ...commonQuery(filters), user_id: filters.identity ?? undefined };
}
