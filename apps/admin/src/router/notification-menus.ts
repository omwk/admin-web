import type { IdentityMenu } from '#/api/model/menu';

/** Defend the notification UI boundary even if a role retained a menu grant. */
export function notificationMenus(
  menus: IdentityMenu[],
  codes: string[],
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = menu.path?.startsWith('/')
      ? menu.path
      : `${parent}/${menu.path ?? ''}`;
    const permissions: Record<string, string> = {
      '/system/notifications/channels': 'system:notify:manage',
      '/system/notifications': 'system:notify:list',
    };
    const permission = permissions[path];
    if (permission && !codes.includes(permission)) return [];
    return [
      {
        ...menu,
        children: notificationMenus(menu.children ?? [], codes, path),
      },
    ];
  });
}
