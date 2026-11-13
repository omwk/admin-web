import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';
import { useAccessStore, useUserStore } from '@vben/stores';

import { getAllMenusApi } from '#/api';

import { auditFallbackRoutes } from './audit-menus';
import { catalogRoutes } from './catalog';
import { componentRegistry } from './component-registry';
import { configurationRoutes } from './configuration-menus';
import { findHomePath } from './menu-adapter';

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  return generateAccessible('backend', {
    ...options,
    fetchMenuListAsync: async () => {
      const routes = await getAllMenusApi();
      const paths = new Set<string>();
      const collectPaths = (items: typeof routes) => {
        for (const item of items) {
          paths.add(item.path);
          if (item.children) collectPaths(item.children);
        }
      };
      collectPaths(routes);
      const catalog = catalogRoutes(useAccessStore().accessCodes).filter(
        (route) => !paths.has(route.path),
      );
      const userStore = useUserStore();
      const configuration = configurationRoutes(
        useAccessStore().accessCodes,
      ).filter((route) => !paths.has(route.path));
      if (userStore.userInfo) {
        userStore.setUserInfo({
          ...userStore.userInfo,
          homePath: findHomePath([...routes, ...catalog, ...configuration]),
        });
      }
      return [
        ...routes,
        ...catalog,
        ...configuration,
        ...auditFallbackRoutes().filter((route) => !paths.has(route.path)),
        {
          component: '/_core/fallback/no-menu.vue',
          meta: { hideInMenu: true, title: '首页' },
          name: 'NoAccessibleMenus',
          path: '/home',
        },
        {
          component: '/pending/index.vue',
          meta: { hideInMenu: true, title: '个人资料' },
          name: 'Profile',
          path: '/profile',
        },
      ];
    },
    forbiddenComponent: () => import('#/views/_core/fallback/forbidden.vue'),
    layoutMap: { MenuOutlet: () => import('#/layouts/menu-outlet.vue') },
    pageMap: componentRegistry,
  });
}

export { generateAccess };
