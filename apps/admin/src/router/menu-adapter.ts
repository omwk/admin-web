import type { RouteRecordStringComponent } from '@vben/types';

import type { IdentityMenu } from '#/api/model/menu';

import {
  FORBIDDEN_COMPONENT,
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
    .filter((menu) => menu.type !== 'button' && menu.status !== 'disabled')
    .toSorted((a, b) => a.sort - b.sort || a.id - b.id)
    .flatMap((menu) => {
      const link =
        menu.is_external || menu.type === 'link'
          ? externalURL(menu.path)
          : undefined;
      const candidate = menu.path?.startsWith('/')
        ? menu.path
        : `${parentPath}/${menu.path || `__menu-${menu.id}`}`;
      let path = candidate;
      if (link) {
        path = `/__external/${menu.id}`;
      } else if (!isInternalPath(candidate)) {
        path = `/__invalid/${menu.id}`;
      }
      const children = menusToRoutes(menu.children ?? [], path);
      const isDirectory = menu.type === 'dir' && children.length > 0;
      let component: string;
      if (link) {
        component = 'pending/index';
      } else if (isDirectory) {
        component = 'MenuOutlet';
      } else {
        component = resolveMenuComponent(menu.component);
      }
      const route: RouteRecordStringComponent = {
        children: isDirectory ? children : [],
        component,
        meta: {
          // Only presentation metadata is accepted; never copy ignoreAccess or
          // other frontend guard flags from the backend's free-form meta object.
          icon: menu.icon || undefined,
          hideInMenu: menu.visible === false,
          keepAlive: menu.keep_alive && component !== FORBIDDEN_COMPONENT,
          order: menu.sort,
          title:
            typeof menu.meta?.title === 'string' ? menu.meta.title : menu.name,
          ...(link ? { link, openInNewWindow: true } : {}),
        },
        name: `IdentityMenu_${menu.id}`,
        path,
      };
      if (isDirectory)
        route.redirect = children.find(
          (child) => !child.meta?.hideInMenu,
        )?.path;
      if (isInternalPath(menu.redirect)) route.redirect = menu.redirect;
      // Page components do not contain a RouterView. Mount their descendants
      // beside the page while retaining the backend-derived sidebar owner.
      return [
        route,
        ...(isDirectory
          ? []
          : children.map((child) =>
              child.meta?.hideInMenu
                ? { ...child, meta: { ...child.meta, activePath: path } }
                : child,
            )),
      ];
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
