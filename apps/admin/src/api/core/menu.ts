import type { RouteRecordStringComponent } from '@vben/types';

import type { MenusData } from '#/api/model/menu';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { menusToRoutes } from '#/router/menu-adapter';

export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const data = await requestClient.get<MenusData>('/auth/menus');
  useAccessStore().setAccessCodes(data.permissions ?? []);
  return menusToRoutes(data.menus ?? []);
}
