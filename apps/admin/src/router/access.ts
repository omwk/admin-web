import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';
import { useAccessStore, useUserStore } from '@vben/stores';

import { getAllMenusApi } from '#/api';

import { auditFallbackRoutes } from './audit-menus';
import { catalogRoutes } from './catalog';
import { componentRegistry } from './component-registry';
import { configurationRoutes } from './configuration-menus';
import { forbiddenShellRoutes, personalRoutes } from './shell';
import { tenantFallbackRoutes } from './tenant-menus';

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  return generateAccessible('backend', {
    ...options,
    fetchMenuListAsync: async () => {
      const reserved = new Set([
        '/403',
        '/home',
        '/profile',
        '/profile/sessions',
      ]);
      const prune = (
        items: Awaited<ReturnType<typeof getAllMenusApi>>,
      ): typeof items =>
        items
          .filter((item) => !reserved.has(item.path))
          .map((item) => ({
            ...item,
            ...(item.children ? { children: prune(item.children) } : {}),
          }));
      const routes = prune(await getAllMenusApi());
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
      const tenants = tenantFallbackRoutes(
        useAccessStore().accessCodes,
        userStore.userInfo,
      ).filter((route) => !paths.has(route.path));
      const configuration = configurationRoutes(
        useAccessStore().accessCodes,
      ).filter((route) => !paths.has(route.path));
      const extraRoutes = [
        ...catalog,
        ...configuration,
        ...tenants,
        ...auditFallbackRoutes().filter((route) => !paths.has(route.path)),
      ];
      collectPaths(extraRoutes);
      if (userStore.userInfo) {
        userStore.setUserInfo({
          ...userStore.userInfo,
          homePath: '/home',
        });
      }
      return [
        ...routes,
        ...extraRoutes,
        ...forbiddenShellRoutes().filter((route) => !paths.has(route.path)),
        ...personalRoutes(),
      ];
    },
    forbiddenComponent: () => import('#/views/_core/fallback/forbidden.vue'),
    layoutMap: { MenuOutlet: () => import('#/layouts/menu-outlet.vue') },
    pageMap: componentRegistry,
  });
}

export { generateAccess };
