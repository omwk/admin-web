import type { IdentityMenu } from '#/api/model/menu';

import { createApp } from 'vue';
import { createMemoryHistory, createRouter } from 'vue-router';

import { initStores, useUserStore } from '@vben/stores';

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { getAllMenusApi } from '#/api/core/menu';

import { generateAccess } from '../access';
import { componentRegistry, resolveMenuComponent } from '../component-registry';
import { createStaticRouteResetter } from '../reset';
import backend from './fixtures/backend-seed-menus.json';

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

describe('menu driven routing', () => {
  it('does not construct business routes from permissions without backend menus', async () => {
    state.permissions = [
      'product:spu:list',
      'product:spu:read',
      'system:dict:list',
      'system:setting:list',
      'system:tenant:list',
      'system:tenant:manage',
    ];
    useUserStore().setUserInfo({
      avatar: '',
      realName: '平台管理员',
      userId: '1',
      username: 'admin',
      tenantId: 1,
      isSuper: true,
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { children: [], meta: { title: 'Root' }, name: 'Root', path: '/' },
        { name: 'NotFound', path: '/:path(.*)*', component: {} },
      ],
    });
    await generateAccess({ router, routes: [] });
    for (const path of [
      '/catalog/products',
      '/catalog/products/7',
      '/system/dicts',
      '/system/settings',
      '/system/tenants',
      '/system/tenants/templates',
      '/system/tenants/templates/3',
      '/system/audit-logs',
      '/system/login-logs',
      '/system/users',
      '/system/notifications',
      '/trade/orders',
    ])
      expect(router.resolve(path).name).toBe('NotFound');
  });

  it('registers hidden detail and editor nodes from the backend, without sidebar entries', async () => {
    useUserStore().setUserInfo({
      avatar: '',
      realName: '平台管理员',
      userId: '1',
      username: 'admin',
      tenantId: 1,
      isSuper: true,
    });
    state.permissions = [
      'product:spu:list',
      'product:spu:read',
      'system:tenant:list',
      'system:tenant:manage',
    ];
    state.menus = [
      menu(1, {
        path: '/catalog',
        type: 'dir',
        children: [
          menu(2, {
            path: '/catalog/products',
            component: 'catalog/product/index',
            permission_code: 'product:spu:list',
            children: [
              menu(3, {
                path: '/catalog/products/:id',
                component: 'catalog/product/detail',
                visible: false,
                permission_code: 'product:spu:read',
              }),
            ],
          }),
        ],
      }),
      menu(4, {
        path: '/system',
        type: 'dir',
        children: [
          menu(5, {
            path: '/system/tenants',
            component: 'system/tenant/index',
            keep_alive: true,
            permission_code: 'system:tenant:list',
            children: [
              menu(6, {
                path: '/system/tenants/templates',
                component: 'system/tenant/index',
                keep_alive: true,
                visible: false,
                permission_code: 'system:tenant:manage',
              }),
              menu(7, {
                path: '/system/tenants/templates/:id',
                component: 'system/tenant/template-editor',
                keep_alive: true,
                visible: false,
                permission_code: 'system:tenant:manage',
              }),
            ],
          }),
        ],
      }),
    ];
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { children: [], name: 'Root', path: '/', meta: { title: 'Root' } },
        { name: 'NotFound', path: '/:path(.*)*', component: {} },
      ],
    });
    const result = await generateAccess({ router, routes: [] });
    for (const [path, component] of [
      ['/catalog/products/7', 'catalog/product/detail'],
      ['/system/tenants/templates', 'system/tenant/index'],
      ['/system/tenants/templates/3', 'system/tenant/template-editor'],
    ] as const) {
      const resolved = router.resolve(path);
      expect(resolved.name).not.toBe('NotFound');
      expect(resolved.matched.at(-1)?.components?.default).toBe(
        componentRegistry[component],
      );
      expect(resolved.meta.hideInMenu).toBe(true);
      expect(resolved.meta.activePath).toBe(
        path.startsWith('/catalog/') ? '/catalog/products' : '/system/tenants',
      );
      expect(resolved.matched.map((record) => record.name)).not.toContain(
        path.startsWith('/catalog/') ? 'IdentityMenu_2' : 'IdentityMenu_5',
      );
    }
    const paths = JSON.stringify(result.accessibleMenus);
    expect(paths).not.toContain('/catalog/products/:id');
    expect(paths).not.toContain('/system/tenants/templates');
    expect(router.resolve('/system/tenants/templates/3').meta.keepAlive).toBe(
      false,
    );
  });

  it('filters backend permission codes and non-platform tenant entries without synthesizing routes', async () => {
    state.menus = [
      menu(1, {
        path: '/system',
        type: 'dir',
        children: [
          menu(2, {
            path: 'dicts',
            permission_code: 'system:dict:list',
            component: 'system/dict/index',
          }),
          menu(3, {
            path: 'settings',
            permission_code: 'system:setting:list',
            component: 'system/setting/index',
          }),
          menu(4, {
            path: 'tenants',
            permission_code: 'system:tenant:list',
            component: 'system/tenant/index',
          }),
        ],
      }),
      menu(5, {
        path: '/catalog/products',
        component: 'catalog/product/index',
        permission_code: 'product:spu:list',
      }),
    ];
    state.permissions = [
      'system:dict:list',
      'system:tenant:list',
      'system:tenant:manage',
    ];
    useUserStore().setUserInfo({
      avatar: '',
      realName: '普通管理员',
      userId: '2',
      username: 'user',
      tenantId: 2,
      isSuper: true,
    });
    const routes = await getAllMenusApi();
    expect(routes.map((route) => route.path)).toEqual(['/system']);
    expect(routes[0]?.children?.map((route) => route.path)).toEqual([
      '/system/dicts',
    ]);
  });

  it('returns 404 after a backend page is removed even when its permission remains', async () => {
    const root = {
      children: [],
      name: 'Root',
      path: '/',
      meta: { title: 'Root' },
    };
    const missing = { name: 'NotFound', path: '/:path(.*)*', component: {} };
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [root, missing],
    });
    const resetRoutes = createStaticRouteResetter(router, [root, missing]);
    state.permissions = ['system:dict:list'];
    state.menus = [
      menu(1, {
        path: '/system/dicts',
        component: 'system/dict/index',
        permission_code: 'system:dict:list',
      }),
    ];
    await generateAccess({ router, routes: [] });
    expect(router.resolve('/system/dicts').name).toBe('IdentityMenu_1');
    resetRoutes();
    state.menus = [];
    await generateAccess({ router, routes: [] });
    expect(router.resolve('/system/dicts').name).toBe('NotFound');
  });

  it('generates a real route for every backend seed page while allowing unused registry entries', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const pages = backend.menus.filter((entry) => entry.type === 'menu');
    state.menus = pages.map((entry, index) =>
      menu(index + 1, {
        component: entry.component,
        path: entry.path,
        visible: entry.visible,
      }),
    );
    state.permissions = [
      'system:tenant:list',
      'system:tenant:manage',
      'system:storage:manage',
      'system:notify:list',
      'system:notify:manage',
      'system:audit:list',
    ];
    useUserStore().setUserInfo({
      avatar: '',
      realName: '平台管理员',
      userId: '1',
      username: 'admin',
      tenantId: 1,
      isSuper: true,
    });
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { children: [], name: 'Root', path: '/', meta: { title: 'Root' } },
      ],
    });
    await generateAccess({ router, routes: [] });
    expect(pages).toHaveLength(20);
    for (const { component, path } of pages) {
      const key = resolveMenuComponent(component);
      const concretePath = path.replace(':id', '7');
      expect(
        router.resolve(concretePath).matched.at(-1)?.components?.default,
      ).toBe(componentRegistry[key]);
    }
    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
