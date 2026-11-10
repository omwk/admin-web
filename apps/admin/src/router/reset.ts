import type { Router, RouteRecordRaw } from 'vue-router';

function copyRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => ({
    ...route,
    meta: { ...route.meta },
    ...(route.children ? { children: copyRoutes(route.children) } : {}),
  })) as RouteRecordRaw[];
}

/** Vben mutates Root.children during generation; retain an untouched snapshot. */
export function createStaticRouteResetter(
  router: Router,
  routes: RouteRecordRaw[],
) {
  const snapshot = copyRoutes(routes);
  return () => {
    for (const route of router.getRoutes()) {
      if (route.name) router.removeRoute(route.name);
    }
    for (const route of copyRoutes(snapshot)) router.addRoute(route);
  };
}
