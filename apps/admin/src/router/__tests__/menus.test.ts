import type { IdentityMenu } from '#/api/model/menu';

import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { initStores, useAccessStore, useUserStore } from '@vben/stores';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllMenusApi } from '#/api/core/menu';
import { hasPermission } from '#/auth/permission';

import { generateAccess } from '../access';
import {
  componentRegistry,
  FORBIDDEN_COMPONENT,
  resolveMenuComponent,
} from '../component-registry';
import { findHomePath, menusToRoutes } from '../menu-adapter';
import { createStaticRouteResetter } from '../reset';

const state = vi.hoisted(() => ({
  menus: [] as IdentityMenu[],
  permissions: [] as string[],
}));
vi.mock('#/api/request', () => ({
  requestClient: {
    get: vi.fn(async () => ({
      menus: state.menus,
      permissions: state.permissions,
    })),
  },
}));

function menu(id: number, values: Partial<IdentityMenu> = {}): IdentityMenu {
  return {
    children: [],
    component: 'system/user/index',
    id,
    is_external: false,
    keep_alive: false,
    meta: {},
    name: `菜单${id}`,
    parent_id: 0,
    path: `/menu-${id}`,
    sort: id,
    type: 'menu',
    ...values,
  };
}

beforeEach(async () => {
  vi.restoreAllMocks();
  localStorage.clear();
  await initStores(createApp({}), { namespace: 'fe1-menus' });
  state.menus = [];
  state.permissions = [];
});

describe('backend menus and permissions', () => {
  it('uses projected department permissions even when navigation has no button nodes', async () => {
    state.menus = [
      menu(13, {
        component: 'system/dept/index',
        name: '部门',
        path: '/system/depts',
      }),
    ];
    state.permissions = [
      'system:user:list',
      'system:dept:create',
      'system:dept:update',
      'system:dept:delete',
    ];

    const routes = await getAllMenusApi();
    expect(routes).toHaveLength(1);
    expect(routes[0]).toMatchObject({
      component: 'system/dept/index',
      path: '/system/depts',
    });
    for (const action of ['create', 'update', 'delete']) {
      expect(hasPermission(`system:dept:${action}`)).toBe(true);
    }

    state.permissions = ['system:user:list'];
    await getAllMenusApi();
    for (const action of ['create', 'update', 'delete']) {
      expect(hasPermission(`system:dept:${action}`)).toBe(false);
    }
    expect(hasPermission('system:user:list')).toBe(true);
  });

  it('converts hierarchy, sort/id order, presentation metadata and keep-alive while dropping buttons', () => {
    const routes = menusToRoutes([
      menu(8, { sort: 1 }),
      menu(1, {
        children: [
          menu(3, { type: 'button' }),
          menu(2, {
            keep_alive: true,
            meta: { ignoreAccess: true, title: '用户' },
            path: 'users',
          }),
        ],
        path: '/system',
        sort: 1,
        type: 'dir',
      }),
      menu(9, { status: 'disabled' }),
      menu(10, { visible: false }),
    ]);
    expect(routes.map((route) => route.name)).toEqual([
      'IdentityMenu_1',
      'IdentityMenu_8',
      'IdentityMenu_10',
    ]);
    expect(routes[0]).toMatchObject({
      component: 'MenuOutlet',
      path: '/system',
      redirect: '/system/users',
    });
    expect(routes[0]?.children).toHaveLength(1);
    expect(routes[0]?.children?.[0]).toMatchObject({
      component: 'system/user/index',
      meta: { keepAlive: true, title: '用户' },
    });
    expect(routes[0]?.children?.[0]?.meta).not.toHaveProperty('ignoreAccess');
    expect(routes[2]?.meta?.hideInMenu).toBe(true);
    expect(findHomePath(routes)).toBe('/system/users');
  });

  it('uses an explicit registry and routes all unknown components to the forbidden loader', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMenuComponent('system/user/index')).toBe('system/user/index');
    expect(resolveMenuComponent('system/dept/index')).toBe('system/dept/index');
    expect(resolveMenuComponent('views/system/user/index')).toBe(
      'system/user/index',
    );
    expect(resolveMenuComponent('../../secret')).toBe(FORBIDDEN_COMPONENT);
    expect(
      menusToRoutes([menu(1, { component: 'unregistered/index' })])[0]
        ?.component,
    ).toBe(FORBIDDEN_COMPONENT);
    expect(componentRegistry[FORBIDDEN_COMPONENT]).toBeTypeOf('function');
    expect(warn).toHaveBeenCalledWith(
      '[router] Unknown menu component:',
      'unregistered/index',
    );
    expect(
      menusToRoutes([
        menu(1, { component: 'system/user', keep_alive: true }),
      ])[0]?.meta?.keepAlive,
    ).toBe(false);
  });

  it('does not resolve directory or external-link components', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const routes = menusToRoutes([
      menu(1, { component: null, type: 'dir', children: [menu(2)] }),
      menu(3, {
        component: null,
        type: 'link',
        path: 'https://example.com/docs',
      }),
    ]);
    expect(routes[0]?.component).toBe('MenuOutlet');
    expect(routes[1]?.component).toBe('pending/index');
    expect(warn).not.toHaveBeenCalled();
  });

  it('keeps external URLs in menu metadata and rejects unsafe protocols', () => {
    const [external, invalid] = menusToRoutes([
      menu(1, {
        is_external: true,
        path: 'https://example.com/docs',
        type: 'link',
      }),
      menu(2, { is_external: true, path: 'javascript:alert(1)', type: 'link' }),
    ]);
    expect(external).toMatchObject({
      meta: { link: 'https://example.com/docs', openInNewWindow: true },
      path: '/__external/1',
    });
    expect(invalid?.meta).not.toHaveProperty('link');
    expect(findHomePath(external ? [external] : [])).toBe('/home');
  });

  it('generates real Vben menus/routes, navigates unknown components, and clears removed role menus on relogin', async () => {
    const root = {
      children: [],
      component: { template: '<router-view />' },
      meta: { title: 'Root' },
      name: 'Root',
      path: '/',
    };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [root],
    });
    const resetRoutes = createStaticRouteResetter(router, [root]);
    state.menus = [
      menu(1, {
        component: 'unknown/index',
        name: '用户',
        path: '/system/users',
      }),
      menu(2, {
        component: 'system/role/index',
        name: '角色',
        path: '/system/roles',
      }),
    ];
    state.permissions = ['system:user:list'];
    useUserStore().setUserInfo({
      avatar: '',
      realName: '测试',
      userId: '1',
      username: 'test',
    });
    const first = await generateAccess({ router, routes: [] });
    expect(first.accessibleMenus.map((item) => item.path)).toEqual([
      '/system/users',
      '/system/roles',
    ]);
    expect(hasPermission('system:user:list')).toBe(true);
    expect(hasPermission('system:user:create')).toBe(false);
    expect(useUserStore().userInfo?.homePath).toBe('/home');
    expect(
      router.resolve('/system/users').matched.at(-1)?.components?.default,
    ).toBe(componentRegistry[FORBIDDEN_COMPONENT]);
    expect(
      router.resolve('/system/roles').matched.at(-1)?.components?.default,
    ).toBe(componentRegistry['system/role/index']);
    resetRoutes();
    useAccessStore().$reset();
    state.menus = [menu(2, { name: '角色', path: '/system/roles' })];
    state.permissions = [];
    const second = await generateAccess({ router, routes: [] });
    expect(second.accessibleMenus.map((item) => item.path)).toEqual([
      '/system/roles',
    ]);
    expect(router.hasRoute('IdentityMenu_1')).toBe(false);
    expect(hasPermission('system:user:list')).toBe(false);
  });

  it('provides a hidden home state for users without menus', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { children: [], meta: { title: 'Root' }, name: 'Root', path: '/' },
      ],
    });
    const result = await generateAccess({ router, routes: [] });
    expect(result.accessibleMenus).toEqual([]);
    expect(router.resolve('/home').matched.at(-1)?.name).toBe('Home');
    expect(router.resolve('/profile').matched.at(-1)?.name).toBe('Profile');
    expect(router.resolve('/profile/notifications').matched.at(-1)?.name).toBe(
      'PersonalNotifications',
    );
    expect(
      router.resolve('/system/notifications/preferences').matched.at(-1)?.name,
    ).toBe('NotificationPreferences');
    expect(router.resolve('/profile/notifications').meta.keepAlive).toBe(false);
    expect(router.resolve('/profile/sessions').matched.at(-1)?.name).toBe(
      'MySessions',
    );
    expect(router.resolve('/system/users').matched).toEqual([]);
    expect(router.resolve('/403').matched.at(-1)?.components?.default).toBe(
      componentRegistry['_core/fallback/forbidden'],
    );
  });
});
