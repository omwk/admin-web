import type { RouteRecordStringComponent } from '@vben/types';

import type { IdentityMenu } from '#/api/model/menu';

import {
  NOT_FOUND_COMPONENT,
  resolveMenuComponent,
} from './component-registry';

export function isInternalPath(path: unknown): path is string {
  return (
    typeof path === 'string' &&
    path.startsWith('/') &&
    !path.startsWith('//') &&
    !path.startsWith('/auth')
  );
}

function externalURL(path?: null | string) {
  try {
    const url = new URL(path ?? '');
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

export function menusToRoutes(
  menus: IdentityMenu[],
  parentPath = '',
): RouteRecordStringComponent[] {
  return [...menus]
    .filter(
      (menu) =>
        menu.type !== 'button' &&
        menu.visible !== false &&
        menu.status !== 'disabled',
    )
    .sort((a, b) => a.sort - b.sort || a.id - b.id)
    .map((menu) => {
      const link =
        menu.is_external || menu.type === 'link'
          ? externalURL(menu.path)
          : undefined;
      const candidate = menu.path?.startsWith('/')
        ? menu.path
        : `${parentPath}/${menu.path || `__menu-${menu.id}`}`;
      const path = link
        ? `/__external/${menu.id}`
        : isInternalPath(candidate)
          ? candidate
          : `/__invalid/${menu.id}`;
      const children = menusToRoutes(menu.children ?? [], path);
      const isDirectory = menu.type === 'dir' && children.length > 0;
      const component = link
        ? '/pending/index.vue'
        : isDirectory
          ? 'MenuOutlet'
          : resolveMenuComponent(menu.component);
      const route: RouteRecordStringComponent = {
        children,
        component,
        meta: {
          // Only presentation metadata is accepted; never copy ignoreAccess or
          // other frontend guard flags from the backend's free-form meta object.
          icon: menu.icon || undefined,
          keepAlive: menu.keep_alive && component !== NOT_FOUND_COMPONENT,
          order: menu.sort,
          title:
            typeof menu.meta?.title === 'string' ? menu.meta.title : menu.name,
          ...(link ? { link, openInNewWindow: true } : {}),
        },
        name: `IdentityMenu_${menu.id}`,
        path,
      };
      if (isDirectory) route.redirect = children[0]?.path;
      if (isInternalPath(menu.redirect)) route.redirect = menu.redirect;
      return route;
    });
}

export function findHomePath(routes: RouteRecordStringComponent[]): string {
  for (const route of routes) {
    if (route.meta?.hideInMenu || route.meta?.link) continue;
    if (route.children?.length) {
      const child = findHomePath(route.children);
      if (child !== '/home') return child;
    } else {
      return route.path;
    }
  }
  return '/home';
}
