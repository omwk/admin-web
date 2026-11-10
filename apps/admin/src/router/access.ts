import type { GenerateMenuAndRoutesOptions } from '@vben/types';

import { generateAccessible } from '@vben/access';
import { useUserStore } from '@vben/stores';

import { getAllMenusApi } from '#/api';

import { componentRegistry } from './component-registry';
import { findHomePath } from './menu-adapter';

async function generateAccess(options: GenerateMenuAndRoutesOptions) {
  return generateAccessible('backend', {
    ...options,
    fetchMenuListAsync: async () => {
      const routes = await getAllMenusApi();
      const userStore = useUserStore();
      if (userStore.userInfo) {
        userStore.setUserInfo({
          ...userStore.userInfo,
          homePath: findHomePath(routes),
        });
      }
      return [
        ...routes,
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
