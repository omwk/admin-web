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
      component: '/_core/profile/notifications.vue',
      path: '/profile/notifications',
      name: 'PersonalNotifications',
      meta: { hideInMenu: true, title: '通知方式', keepAlive: false },
    },
    {
      component: '/system/notification/preferences-page.vue',
      path: '/system/notifications/preferences',
      name: 'NotificationPreferences',
      meta: { hideInMenu: true, title: '通知偏好', keepAlive: false },
    },
    {
      component: '/_core/profile/sessions.vue',
      path: '/profile/sessions',
      name: 'MySessions',
      meta: { hideInMenu: true, title: '我的会话', keepAlive: false },
    },
  ];
}

/** Shared permission-denied page; business paths only come from backend menus. */
export function forbiddenShellRoutes(): RouteRecordStringComponent[] {
  return [
    {
      path: '/403',
      name: 'Forbidden',
      component: '/_core/fallback/forbidden.vue',
      meta: { hideInMenu: true, hideInTab: true, title: '403' },
    },
  ];
}
