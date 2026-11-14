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
  NOT_FOUND_COMPONENT,
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
      component: '/system/dept/index.vue',
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
    ]);
    expect(routes[0]).toMatchObject({
      component: 'MenuOutlet',
      path: '/system',
      redirect: '/system/users',
    });
    expect(routes[0]?.children).toHaveLength(1);
    expect(routes[0]?.children?.[0]).toMatchObject({
      component: '/system/user/index.vue',
      meta: { keepAlive: true, title: '用户' },
    });
    expect(routes[0]?.children?.[0]?.meta).not.toHaveProperty('ignoreAccess');
    expect(findHomePath(routes)).toBe('/system/users');
  });

  it('uses an explicit registry and routes all unknown components to the existing 404 loader', () => {
    expect(resolveMenuComponent('system/user/index')).toBe(
      '/system/user/index.vue',
    );
    expect(resolveMenuComponent('system/dept/index')).toBe(
      '/system/dept/index.vue',
    );
    expect(resolveMenuComponent('/views/system/user/index.vue')).toBe(
      '/system/user/index.vue',
    );
    expect(resolveMenuComponent('../../secret')).toBe(NOT_FOUND_COMPONENT);
    expect(
      menusToRoutes([menu(1, { component: 'unregistered/index' })])[0]
        ?.component,
    ).toBe(NOT_FOUND_COMPONENT);
    expect(componentRegistry[NOT_FOUND_COMPONENT]).toBeTypeOf('function');
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
    ).toBe(componentRegistry[NOT_FOUND_COMPONENT]);
    expect(
      router.resolve('/system/roles').matched.at(-1)?.components?.default,
    ).toBe(componentRegistry['/system/role/index.vue']);
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
    expect(router.resolve('/profile/sessions').matched.at(-1)?.name).toBe(
      'MySessions',
    );
    expect(
      router.resolve('/system/users').matched.at(-1)?.components?.default,
    ).toBe(componentRegistry['/_core/fallback/forbidden.vue']);
  });

  it('keeps granted fallback routes instead of overwriting them with 403', async () => {
    state.permissions = [
      'catalog:product:list',
      'system:config:list',
      'system:tenant:list',
    ];
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { children: [], meta: { title: 'Root' }, name: 'Root', path: '/' },
      ],
    });
    await generateAccess({ router, routes: [] });
    expect(
      router.resolve('/catalog/products').matched.at(-1)?.components?.default,
    ).toBe(componentRegistry['/catalog/product/index.vue']);
  });
});
