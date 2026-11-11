import type { Router } from 'vue-router';

import { LOGIN_PATH } from '@vben/constants';
import { preferences } from '@vben/preferences';
import { isCancel } from '@vben/request';
import { useAccessStore, useUserStore } from '@vben/stores';
import { startProgress, stopProgress } from '@vben/utils';

import { hasCatalogPermission } from '#/auth/catalog-permission';
import { getAccessToken } from '#/auth/token';
import { accessRoutes, coreRouteNames } from '#/router/routes';
import { useAuthStore } from '#/store';

import { generateAccess } from './access';
import { catalogRouteAction } from './catalog';
import { isInternalPath } from './menu-adapter';

function safeRedirect(value: unknown, fallback: string) {
  if (typeof value !== 'string') return fallback;
  try {
    const path = decodeURIComponent(value);
    return isInternalPath(path) ? path : fallback;
  } catch {
    return fallback;
  }
}

function createRouterGuard(router: Router) {
  const loadedPaths = new Set<string>();
  router.beforeEach(async (to) => {
    to.meta.loaded = loadedPaths.has(to.path);
    if (!to.meta.loaded && preferences.transition.progress)
      void startProgress();

    const accessStore = useAccessStore();
    const userStore = useUserStore();
    const authStore = useAuthStore();
    if (coreRouteNames.includes(to.name)) {
      if (to.path === LOGIN_PATH && getAccessToken()) {
        return safeRedirect(
          to.query.redirect,
          userStore.userInfo?.homePath || preferences.app.defaultHomePath,
        );
      }
      return true;
    }

    if (!getAccessToken() && !(await authStore.restoreSession())) {
      return {
        path: LOGIN_PATH,
        query:
          to.path === preferences.app.defaultHomePath
            ? {}
            : { redirect: encodeURIComponent(to.fullPath) },
        replace: true,
      };
    }
    if (accessStore.isAccessChecked) {
      const action = catalogRouteAction(to.path);
      return action && !hasCatalogPermission(action)
        ? { path: '/403', replace: true }
        : true;
    }

    try {
      const userInfo = userStore.userInfo || (await authStore.fetchUserInfo());
      const { accessibleMenus, accessibleRoutes } = await generateAccess({
        roles: userInfo.roles ?? [],
        router,
        routes: accessRoutes,
      });
      accessStore.setAccessMenus(accessibleMenus);
      accessStore.setAccessRoutes(accessibleRoutes);
      accessStore.setIsAccessChecked(true);
      const path =
        to.path === preferences.app.defaultHomePath
          ? userStore.userInfo?.homePath || to.path
          : to.path;
      return { path, hash: to.hash, query: to.query, replace: true };
    } catch (error) {
      if (isCancel(error)) return false;
      await authStore.expireSession();
      return { path: LOGIN_PATH, replace: true };
    }
  });

  router.afterEach((to) => {
    loadedPaths.add(to.path);
    if (preferences.transition.progress) void stopProgress();
  });
  router.onError(() => {
    if (preferences.transition.progress) void stopProgress();
  });
}

export { createRouterGuard };
