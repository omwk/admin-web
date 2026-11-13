import type { IdentityMenu } from '#/api/model/menu';

import { describe, expect, it } from 'vitest';

import { resolveMenuComponent } from '../component-registry';
import {
  configurationMenus,
  configurationRoutes,
} from '../configuration-menus';

describe('dictionary/settings permissions', () => {
  it('hides retained menu grants, including relative children, without list permissions', () => {
    const menu: IdentityMenu = {
      id: 1,
      parent_id: 0,
      name: '系统',
      type: 'dir',
      path: '/system',
      sort: 1,
      is_external: false,
      keep_alive: false,
      meta: {},
      children: [
        {
          id: 2,
          parent_id: 1,
          name: '字典',
          type: 'menu',
          path: 'dicts',
          sort: 1,
          is_external: false,
          keep_alive: false,
          meta: {},
        },
        {
          id: 3,
          parent_id: 1,
          name: '配置',
          type: 'menu',
          path: '/system/settings',
          sort: 2,
          is_external: false,
          keep_alive: false,
          meta: {},
        },
      ],
    };
    expect(configurationMenus([menu], [])[0]?.children).toEqual([]);
    expect(
      configurationMenus([menu], ['system:dict:list'])[0]?.children?.map(
        (child) => child.id,
      ),
    ).toEqual([2]);
  });
  it('resolves direct navigation to 403 or a permission-backed entry when projection is missing', () => {
    expect(
      configurationRoutes([]).every(
        (route) =>
          route.component === '/_core/fallback/forbidden.vue' &&
          route.meta?.hideInMenu,
      ),
    ).toBe(true);
    expect(configurationRoutes(['system:setting:list'])[1]).toMatchObject({
      path: '/system/settings',
      component: '/system/setting/index.vue',
      meta: { hideInMenu: false },
    });
    expect(resolveMenuComponent('system/dict/index')).toBe(
      '/system/dict/index.vue',
    );
    expect(resolveMenuComponent('system/settings/index')).toBe(
      '/system/settings/index.vue',
    );
  });
});
