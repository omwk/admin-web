import type { RouteRecordStringComponent } from '@vben/types';

import type { CatalogAction } from '#/auth/catalog-permission';

import { allowsCatalog } from '#/auth/catalog-permission';

export function catalogRouteAction(path: string): CatalogAction | undefined {
  if (/^\/catalog\/products\/?$/.test(path)) return 'list';
  if (/^\/catalog\/products\/[^/]+\/?$/.test(path)) return 'read';
  return undefined;
}

/** The live menu seed has no catalog entry; use the verified API permission. */
export function catalogRoutes(codes: string[]): RouteRecordStringComponent[] {
  return [
    {
      component: allowsCatalog(codes, 'list')
        ? '/catalog/product/index.vue'
        : '/_core/fallback/forbidden.vue',
      meta: { hideInMenu: !allowsCatalog(codes, 'list'), title: '商品管理' },
      name: 'CatalogProductList',
      path: '/catalog/products',
    },
    {
      component: allowsCatalog(codes, 'read')
        ? '/catalog/product/detail.vue'
        : '/_core/fallback/forbidden.vue',
      meta: { hideInMenu: true, title: '商品详情' },
      name: 'CatalogProductDetail',
      path: '/catalog/products/:id',
    },
    {
      component: '/_core/fallback/forbidden.vue',
      meta: { hideInMenu: true, hideInTab: true, title: '403' },
      name: 'CatalogForbidden',
      path: '/403',
    },
  ];
}
