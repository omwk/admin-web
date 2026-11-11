import { describe, expect, it } from 'vitest';

import { catalogRouteAction, catalogRoutes } from '#/router/catalog';

import { allowsCatalog } from '../catalog-permission';

describe('catalog access boundaries', () => {
  it('recognizes each canonical or verified backend grant independently', () => {
    for (const namespace of ['catalog:product', 'product:spu']) {
      expect(allowsCatalog([`${namespace}:list`], 'list')).toBe(true);
      expect(allowsCatalog([`${namespace}:list`], 'read')).toBe(false);
      expect(allowsCatalog([`${namespace}:read`], 'list')).toBe(false);
      expect(allowsCatalog([`${namespace}:read`], 'export')).toBe(false);
      expect(allowsCatalog([`${namespace}:export`], 'export')).toBe(true);
    }
    expect(allowsCatalog(['product:spu:*'], 'list')).toBe(false);
    expect(allowsCatalog([], 'list')).toBe(false);
  });

  it('hides ungranted menus and provides a forbidden component for direct URLs', () => {
    const denied = catalogRoutes([]);
    expect(denied.every((route) => route.meta?.hideInMenu)).toBe(true);
    expect(
      denied.every(
        (route) => route.component === '/_core/fallback/forbidden.vue',
      ),
    ).toBe(true);
    const listOnly = catalogRoutes(['catalog:product:list']);
    expect(listOnly[0]?.meta?.hideInMenu).toBe(false);
    expect(listOnly[1]?.component).toBe('/_core/fallback/forbidden.vue');
    expect(catalogRouteAction('/catalog/products')).toBe('list');
    expect(catalogRouteAction('/catalog/products/120/')).toBe('read');
    expect(catalogRouteAction('/system/users')).toBeUndefined();
  });
});
