import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';
import { useUserStore } from '@vben/stores';

import { getAllMenusApi } from '#/api';

import { componentRegistry } from './component-registry';
import { forbiddenShellRoutes, personalRoutes } from './shell';

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
      const userStore = useUserStore();
      if (userStore.userInfo) {
        userStore.setUserInfo({
          ...userStore.userInfo,
          homePath: '/home',
        });
      }
      return [...routes, ...forbiddenShellRoutes(), ...personalRoutes()];
    },
    forbiddenComponent: () => import('#/views/_core/fallback/forbidden.vue'),
    layoutMap: { MenuOutlet: () => import('#/layouts/menu-outlet.vue') },
    pageMap: componentRegistry,
  });
}

export { generateAccess };
