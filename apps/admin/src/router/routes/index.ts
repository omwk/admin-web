import type { RouteRecordRaw } from 'vue-router';

import { traverseTreeValues } from '@vben/utils';

import { coreRoutes, fallbackNotFoundRoute } from './core';

const routes: RouteRecordRaw[] = [...coreRoutes, fallbackNotFoundRoute];
const coreRouteNames = traverseTreeValues(coreRoutes, (route) => route.name);
// The backend menu projection is the sole source of permissioned navigation.
const accessRoutes: RouteRecordRaw[] = [];
export { accessRoutes, coreRouteNames, routes };
