import { useUserStore } from '@vben/stores';

import { hasPermission } from './permission';

export const platformTenantId = Number(
  import.meta.env.VITE_PLATFORM_TENANT_ID || 1,
);

export interface TenantIdentity extends Record<string, unknown> {
  isSuper?: boolean;
  tenantId?: number;
}

export function isPlatformAdministrator(user?: null | TenantIdentity) {
  return user?.isSuper === true && user.tenantId === platformTenantId;
}

export function canViewTenants() {
  return (
    isPlatformAdministrator(useUserStore().userInfo) &&
    hasPermission('system:tenant:list')
  );
}

export function canManageTenants() {
  return canViewTenants() && hasPermission('system:tenant:manage');
}
