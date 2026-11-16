import type { AuditLog } from '#/api/model/audit';

import { describe, expect, it } from 'vitest';

import {
  accessedTenantCount,
  actionLabel,
  actorLabel,
  resourceLabel,
  targetTenantLabel,
} from '../audit-display';

const record = (fields: Partial<AuditLog>) => fields as AuditLog;

describe('readable audit snapshots', () => {
  it('uses immutable actor names and keeps old records identifiable', () => {
    expect(
      actorLabel(record({ actor_name: 'admin', actor_tenant_name: 'default' })),
    ).toBe('admin（default）');
    expect(actorLabel(record({ actor_name: 'sales01' }))).toBe('sales01');
    expect(actorLabel(record({ actor_type: 'user', actor_id: 7 }))).toBe(
      '用户 #7',
    );
    expect(actorLabel(record({ actor_type: 'system', actor_id: null }))).toBe(
      '系统',
    );
  });
  it('labels resources and falls back to IDs without additional lookups', () => {
    for (const [type, label, expected] of [
      ['tenant', 'acme', '租户 acme'],
      ['user', 'sales01', '用户 sales01'],
      ['dict', 'order_status', '字典 order_status'],
    ] as const)
      expect(
        resourceLabel(record({ resource_type: type, resource_label: label })),
      ).toBe(expected);
    expect(
      resourceLabel(record({ resource_id: '2', resource_label: null })),
    ).toBe('#2');
    expect(
      resourceLabel(
        record({ resource_type: 'future', resource_label: 'label' }),
      ),
    ).toBe('future label');
  });
  it('translates registered actions and preserves unknown action codes', () => {
    expect(actionLabel('system.dept.create')).toBe('系统 / 部门 / 创建');
    expect(actionLabel('system.tenant.list')).toBe(
      '系统 / 租户 / 跨租户列表访问',
    );
    expect(actionLabel('identity.login')).toBe('身份 / 登录（成功或失败）');
    expect(actionLabel('future.action')).toBe('future.action');
  });
  it('uses tenant IDs for access scope, including zero and member reads, and validates metadata', () => {
    expect(accessedTenantCount({ accessed_tenants: [2, 3], count: 2 })).toBe(2);
    expect(accessedTenantCount({ accessed_tenants: [], count: 0 })).toBe(0);
    // The backend members action count is the number of users, not tenants.
    expect(accessedTenantCount({ accessed_tenants: [2], count: 8 })).toBe(1);
    expect(accessedTenantCount({ accessed_tenants: [2, 2], count: 2 })).toBe(1);
    expect(accessedTenantCount({ count: 2 })).toBeUndefined();
    expect(accessedTenantCount(null)).toBeUndefined();
    expect(targetTenantLabel({ target_tenant: 'acme' })).toBe('acme');
    expect(targetTenantLabel({ target_tenant: 2 })).toBe('#2');
    expect(targetTenantLabel(null)).toBe('—');
  });
});
