import type { RouteRecordStringComponent } from '@vben/types';

import type { MenusData } from '#/api/model/menu';

import { useAccessStore, useUserStore } from '@vben/stores';

import { requestClient } from '#/api/request';
import { auditMenus } from '#/router/audit-menus';
import { menusToRoutes } from '#/router/menu-adapter';
import { authorizedMenus } from '#/router/menu-permissions';
import { notificationMenus } from '#/router/notification-menus';

export async function getAllMenusApi(): Promise<RouteRecordStringComponent[]> {
  const data = await requestClient.get<MenusData>('/auth/menus');
  useAccessStore().setAccessCodes(data.permissions ?? []);
  return menusToRoutes(
    authorizedMenus(
      auditMenus(
        notificationMenus(data.menus ?? [], data.permissions ?? []),
        data.permissions ?? [],
      ),
      data.permissions ?? [],
      useUserStore().userInfo,
    ),
  );
}
