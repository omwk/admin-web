import type { RouteRecordStringComponent } from '@vben/types';

/** Personal pages require a login, with no system-menu permission dependency. */
export function personalRoutes(): RouteRecordStringComponent[] {
  return [
    {
      component: '/home/index.vue',
      path: '/home',
      name: 'Home',
      meta: { hideInMenu: true, title: '首页' },
    },
    {
      component: '/_core/profile/index.vue',
      path: '/profile',
      name: 'Profile',
      meta: { hideInMenu: true, title: '个人资料', keepAlive: false },
    },
    {
      component: '/_core/profile/sessions.vue',
      path: '/profile/sessions',
      name: 'MySessions',
      meta: { hideInMenu: true, title: '我的会话', keepAlive: false },
    },
  ];
}

/** Missing grants for known application pages resolve to 403; unknown URLs stay 404. */
export function forbiddenShellRoutes(): RouteRecordStringComponent[] {
  return [
    '/system/users',
    '/system/roles',
    '/system/menus',
    '/system/depts',
    '/system/notifications',
    '/system/notifications/channels',
    '/trade/orders',
    '/crm/customers',
    '/crm/inquiries',
  ].map((path, index) => ({
    path,
    name: `ShellForbidden_${index}`,
    component: '/_core/fallback/forbidden.vue',
    meta: { hideInMenu: true, hideInTab: true, title: '403' },
  }));
}
