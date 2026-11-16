import type { AuditLog, JsonValue } from '#/api/model/audit';

import { auditActionLabels } from './audit-actions';

const actorTypes: Record<string, string> = {
  user: '用户',
  system: '系统',
  api_client: 'API 客户端',
};
const resourceTypes: Record<string, string> = {
  tenant: '租户',
  user: '用户',
  dict: '字典',
  dict_item: '字典项',
  tenant_template: '租户模板',
  dept: '部门',
  role: '角色',
  menu: '菜单',
  setting: '配置',
  invite: '邀请',
  notification: '通知',
  shop: '店铺',
};

export function actorLabel(record: AuditLog): string {
  const name = record.actor_name?.trim();
  const tenant = record.actor_tenant_name?.trim();
  if (name) return tenant ? `${name}（${tenant}）` : name;
  const type = actorTypes[record.actor_type] || record.actor_type || '用户';
  return record.actor_id === null || record.actor_id === undefined
    ? type
    : `${type} #${record.actor_id}`;
}

export function resourceLabel(record: AuditLog): string {
  const label = record.resource_label?.trim();
  if (!label) return record.resource_id ? `#${record.resource_id}` : '—';
  const type = resourceTypes[record.resource_type] || record.resource_type;
  return type ? `${type} ${label}` : label;
}

export function actionLabel(action: string): string {
  return auditActionLabels[action] || action || '—';
}

function metadata(value: JsonValue) {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value
    : undefined;
}

export function accessedTenantCount(after: JsonValue): number | undefined {
  const tenants = metadata(after)?.accessed_tenants;
  if (
    !Array.isArray(tenants) ||
    !tenants.every(
      (id) => typeof id === 'number' && Number.isSafeInteger(id) && id > 0,
    )
  )
    return undefined;
  // Members reads use count for member count; the tenant array defines scope.
  return new Set(tenants).size;
}

export function targetTenantLabel(after: JsonValue): string {
  const tenant = metadata(after)?.target_tenant;
  if (typeof tenant === 'string') return tenant.trim() || '—';
  if (typeof tenant === 'number') return `#${tenant}`;
  const details = tenant === undefined ? undefined : metadata(tenant);
  return typeof details?.name === 'string' ? details.name : '—';
}
