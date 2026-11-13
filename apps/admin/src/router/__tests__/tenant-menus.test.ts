import type { IdentityMenu } from '#/api/model/menu';

import { describe, expect, it } from 'vitest';

import { isPlatformAdministrator, platformTenantId } from '#/auth/tenant';

import { resolveMenuComponent } from '../component-registry';
import { tenantFallbackRoutes, tenantMenus } from '../tenant-menus';

const platform = { tenantId: platformTenantId, isSuper: true };
const codes = ['system:tenant:list'];
const menu: IdentityMenu = {
  id: 1,
  parent_id: 0,
  name: '系统',
  type: 'dir',
  path: '/system',
  sort: 1,
  is_external: false,
  keep_alive: true,
  meta: {},
  children: [
    {
      id: 2,
      parent_id: 1,
      name: '租户管理',
      type: 'menu',
      path: 'tenants/',
      sort: 1,
      is_external: false,
      keep_alive: true,
      meta: {},
    },
  ],
};
describe('platform tenant entry', () => {
  it('requires platform tenant membership, super status and list permission', () => {
    expect(isPlatformAdministrator(platform)).toBe(true);
    for (const identity of [
      undefined,
      { ...platform, isSuper: false },
      { ...platform, tenantId: platformTenantId + 1 },
    ]) {
      expect(tenantMenus([menu], codes, identity)[0]?.children).toEqual([]);
      expect(tenantFallbackRoutes(codes, identity)[0]).toMatchObject({
        component: '/_core/fallback/forbidden.vue',
        meta: { hideInMenu: true },
      });
    }
    expect(tenantMenus([menu], [], platform)[0]?.children).toEqual([]);
  });
  it('resolves the projected page and disables caching even when backend enables keep_alive', () => {
    expect(
      tenantMenus([menu], codes, platform)[0]?.children?.[0]?.keep_alive,
    ).toBe(false);
    expect(tenantFallbackRoutes(codes, platform)[0]).toMatchObject({
      component: '/system/tenant/index.vue',
      meta: { keepAlive: false },
    });
    expect(resolveMenuComponent('system/tenant/index')).toBe(
      '/system/tenant/index.vue',
    );
    expect(resolveMenuComponent('system/tenants/index')).toBe(
      '/system/tenants/index.vue',
    );
  });
});
