import type { RouteRecordStringComponent } from '@vben/types';

import type { MenusData } from '#/api/model/menu';

import { useAccessStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { auditMenus } from '#/router/audit-menus';
import { menusToRoutes } from '#/router/menu-adapter';
import { notificationMenus } from '#/router/notification-menus';

export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const data = await requestClient.get<MenusData>('/auth/menus');
  useAccessStore().setAccessCodes(data.permissions ?? []);
  return menusToRoutes(
    auditMenus(
      notificationMenus(data.menus ?? [], data.permissions ?? []),
      data.permissions ?? [],
    ),
  );
}
