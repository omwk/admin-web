import type { IdentityMenu } from '#/api/model/menu';
import type { TenantIdentity } from '#/auth/tenant';

import { isPlatformAdministrator, platformTenantId } from '#/auth/tenant';

/** Filter projected nodes; permissions never create a missing business route. */
export function authorizedMenus(
  menus: IdentityMenu[],
  codes: string[],
  user?: null | TenantIdentity,
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = (
      menu.path?.startsWith('/') ? menu.path : `${parent}/${menu.path ?? ''}`
    ).replace(/\/$/, '');
    const tenant =
      path === '/system/tenants' || path.startsWith('/system/tenants/');
    const storage =
      path === '/system/storage' || path.startsWith('/system/storage/');
    if (
      storage &&
      (user?.tenantId !== platformTenantId ||
        !codes.includes('system:storage:manage'))
    )
      return [];
    if (menu.permission_code && !codes.includes(menu.permission_code))
      return [];
    if (
      tenant &&
      (!isPlatformAdministrator(user) || !codes.includes('system:tenant:list'))
    )
      return [];
    const children = authorizedMenus(menu.children ?? [], codes, user, path);
    if (menu.type === 'dir' && children.length === 0) return [];
    return [
      {
        ...menu,
        children,
        // Invitation credentials must disappear on navigation.
        keep_alive: tenant || storage ? false : menu.keep_alive,
      },
    ];
  });
}
