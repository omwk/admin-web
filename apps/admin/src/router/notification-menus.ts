import type { RouteRecordStringComponent } from '@vben/types';

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
      '/system/notifications/broadcasts': 'system:notify:broadcast',
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

export function broadcastRouteDenied(path: string, codes: string[]) {
  return (
    path.replace(/\/$/, '') === '/system/notifications/broadcasts' &&
    !codes.includes('system:notify:broadcast')
  );
}

/** The current backend catalogue has no broadcast menu; allow the inbox action's destination. */
export function broadcastEntryRoutes(
  routes: RouteRecordStringComponent[],
  codes: string[],
): RouteRecordStringComponent[] {
  const contains = (items: RouteRecordStringComponent[]): boolean =>
    items.some(
      (item) =>
        item.path === '/system/notifications/broadcasts' ||
        contains(item.children ?? []),
    );
  if (!codes.includes('system:notify:broadcast') || contains(routes)) return [];
  return [
    {
      path: '/system/notifications/broadcasts',
      name: 'SystemNotificationBroadcasts',
      component: 'system/notification/broadcasts',
      meta: { hideInMenu: true, title: '公告发布', keepAlive: false },
    },
  ];
}
