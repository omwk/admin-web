import type { RouteRecordStringComponent } from '@vben/types';

import type { IdentityMenu } from '#/api/model/menu';
import type { TenantIdentity } from '#/auth/tenant';

import { isPlatformAdministrator } from '#/auth/tenant';

const tenantPath = '/system/tenants';
const allowed = (codes: string[], user?: null | TenantIdentity) =>
  isPlatformAdministrator(user) && codes.includes('system:tenant:list');

export function tenantMenus(
  menus: IdentityMenu[],
  codes: string[],
  user?: null | TenantIdentity,
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = menu.path?.startsWith('/')
      ? menu.path
      : `${parent}/${menu.path ?? ''}`;
    const tenant =
      path.replace(/\/$/, '') === tenantPath ||
      path.startsWith(`${tenantPath}/`);
    if (tenant && !allowed(codes, user)) return [];
    return [
      {
        ...menu,
        // Invitation credentials must disappear on navigation.
        keep_alive: tenant ? false : menu.keep_alive,
        children: tenantMenus(menu.children ?? [], codes, user, path),
      },
    ];
  });
}

export function tenantFallbackRoutes(
  codes: string[],
  user?: null | TenantIdentity,
): RouteRecordStringComponent[] {
  const visible = allowed(codes, user);
  const manageable = visible && codes.includes('system:tenant:manage');
  return [
    {
      path: tenantPath,
      name: 'SystemTenants',
      component: visible
        ? '/system/tenant/index.vue'
        : '/_core/fallback/forbidden.vue',
      meta: { title: '租户管理', hideInMenu: !visible, keepAlive: false },
    },
    {
      path: `${tenantPath}/templates`,
      name: 'SystemTenantTemplates',
      component: manageable
        ? '/system/tenant/index.vue'
        : '/_core/fallback/forbidden.vue',
      meta: { title: '租户模板', hideInMenu: true, keepAlive: false },
    },
    {
      path: `${tenantPath}/templates/:id`,
      name: 'SystemTenantTemplateEditor',
      component: manageable
        ? '/system/tenant/template-editor.vue'
        : '/_core/fallback/forbidden.vue',
      meta: {
        title: '编辑租户模板',
        hideInMenu: true,
        keepAlive: false,
        activePath: tenantPath,
      },
    },
  ];
}
