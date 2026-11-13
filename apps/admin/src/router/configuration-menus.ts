import type { RouteRecordStringComponent } from '@vben/types';

import type { IdentityMenu } from '#/api/model/menu';

const pages = [
  {
    path: '/system/dicts',
    permission: 'system:dict:list',
    component: '/system/dict/index.vue',
    title: '数据字典',
  },
  {
    path: '/system/settings',
    permission: 'system:setting:list',
    component: '/system/setting/index.vue',
    title: '系统配置',
  },
];

/** Retained menu grants never override API permissions. */
export function configurationMenus(
  menus: IdentityMenu[],
  codes: string[],
  parent = '',
): IdentityMenu[] {
  return menus.flatMap((menu) => {
    const path = menu.path?.startsWith('/')
      ? menu.path
      : `${parent}/${menu.path ?? ''}`;
    const page = pages.find((page) => page.path === path.replace(/\/$/, ''));
    if (page && !codes.includes(page.permission)) return [];
    return [
      {
        ...menu,
        children: configurationMenus(menu.children ?? [], codes, path),
      },
    ];
  });
}

/** Like catalog routes, fill absent backend projections using API permissions. */
export function configurationRoutes(
  codes: string[],
): RouteRecordStringComponent[] {
  return pages.map((page, index) => ({
    path: page.path,
    name: `SystemConfiguration_${index}`,
    component: codes.includes(page.permission)
      ? page.component
      : '/_core/fallback/forbidden.vue',
    meta: { title: page.title, hideInMenu: !codes.includes(page.permission) },
  }));
}
