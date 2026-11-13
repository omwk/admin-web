import type { RouteRecordStringComponent } from '@vben/types';

import type { IdentityMenu } from '#/api/model/menu';

const paths = ['/system/audit-logs', '/system/login-logs'];

/** A retained menu grant must not expose pages without the audit permission. */
export function auditMenus(
  menus: IdentityMenu[],
  codes: string[],
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = menu.path?.startsWith('/')
      ? menu.path
      : `${parent}/${menu.path ?? ''}`;
    if (
      paths.includes(path.replace(/\/$/, '')) &&
      !codes.includes('system:audit:list')
    )
      return [];
    return [
      { ...menu, children: auditMenus(menu.children ?? [], codes, path) },
    ];
  });
}

/** Absent projected menus still resolve direct navigation to the existing 403. */
export function auditFallbackRoutes(): RouteRecordStringComponent[] {
  return paths.map((path, index) => ({
    component: '/_core/fallback/forbidden.vue',
    meta: { hideInMenu: true, title: '403' },
    name: `AuditForbidden_${index}`,
    path,
  }));
}
