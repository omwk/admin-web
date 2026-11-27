import type { IdentityMenu } from '#/api/model/menu';

import { describe, expect, it } from 'vitest';

import { platformTenantId } from '#/auth/tenant';

import { resolveMenuComponent } from '../component-registry';
import { authorizedMenus } from '../menu-permissions';

const platform = { tenantId: platformTenantId, isSuper: true };
const codes = ['system:tenant:list'];
const system: IdentityMenu = {
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
      permission_code: 'system:tenant:list',
      children: [
        {
          id: 3,
          parent_id: 2,
          name: '模板编辑',
          type: 'menu',
          path: 'templates/:id',
          component: 'system/tenant/template-editor',
          sort: 1,
          is_external: false,
          keep_alive: true,
          meta: {},
          visible: false,
          permission_code: 'system:tenant:manage',
        },
      ],
    },
  ],
};

describe('backend menu permission boundaries', () => {
  it('hides storage from other tenants and missing permissions, disabling cache for granted operators', () => {
    const storage: IdentityMenu = {
      ...system,
      type: 'menu',
      path: '/system/storage',
      children: [],
    };
    const permission = ['system:storage:manage'];
    expect(authorizedMenus([storage], [], platform)).toEqual([]);
    expect(
      authorizedMenus([storage], permission, {
        ...platform,
        tenantId: platformTenantId + 1,
      }),
    ).toEqual([]);
    expect(
      authorizedMenus([storage], permission, { ...platform, isSuper: false })[0]
        ?.keep_alive,
    ).toBe(false);
    expect(resolveMenuComponent('system/storage/index')).toBe(
      'system/storage/index',
    );
    expect(resolveMenuComponent('system/files/index')).toBe(
      'system/files/index',
    );
  });

  it('requires platform tenant membership, super status and list permission', () => {
    for (const user of [
      undefined,
      { ...platform, isSuper: false },
      { ...platform, tenantId: platformTenantId + 1 },
    ]) {
      expect(authorizedMenus([system], codes, user)).toEqual([]);
    }
    expect(authorizedMenus([system], [], platform)).toEqual([]);
  });

  it('filters template manage separately and keeps every tenant page uncached', () => {
    const listOnly = authorizedMenus([system], codes, platform)[0]
      ?.children?.[0];
    expect(listOnly?.children).toEqual([]);
    expect(listOnly?.keep_alive).toBe(false);
    const manageable = authorizedMenus(
      [system],
      [...codes, 'system:tenant:manage'],
      platform,
    )[0]?.children?.[0];
    expect(manageable?.children?.[0]).toMatchObject({
      visible: false,
      keep_alive: false,
    });
    expect(system.children?.[0]?.keep_alive).toBe(true);
  });

  it('filters dictionary/settings nodes by their projected permission codes', () => {
    const children = ['dict', 'setting'].map((resource, index) => ({
      ...system,
      id: index + 2,
      type: 'menu' as const,
      children: [],
      path: `${resource}s`,
      permission_code: `system:${resource}:list`,
    }));
    expect(authorizedMenus([{ ...system, children }], [])).toEqual([]);
    expect(
      authorizedMenus(
        [{ ...system, children }],
        ['system:dict:list'],
      )[0]?.children?.map((child) => child.path),
    ).toEqual(['dicts']);
  });

  it('preserves backend component aliases without adding routes', () => {
    for (const component of [
      'system/dict/index',
      'system/settings/index',
      'system/tenant/index',
      'system/tenants/index',
      'system/tenant/template-editor',
    ]) {
      expect(resolveMenuComponent(component)).toBe(component);
    }
    expect(
      authorizedMenus([], [...codes, 'system:tenant:manage'], platform),
    ).toEqual([]);
  });

  it('resolves the four dynamically authorized gateway pages', () => {
    const pages = [
      [
        '/open-platform/clients',
        'open-platform/clients/index',
        'gateway:client:list',
      ],
      [
        '/open-platform/routes',
        'open-platform/routes/index',
        'gateway:route:list',
      ],
      [
        '/open-platform/calls',
        'open-platform/calls/index',
        'gateway:call:read',
      ],
      [
        '/open-platform/usage',
        'open-platform/usage/index',
        'gateway:call:read',
      ],
    ] as const;
    for (const [path, component, permission] of pages) {
      expect(resolveMenuComponent(component)).toBe(component);
      const menu: IdentityMenu = {
        ...system,
        type: 'menu',
        path,
        component,
        permission_code: permission,
        children: [],
      };
      expect(authorizedMenus([menu], [permission])).toHaveLength(1);
      expect(authorizedMenus([menu], [])).toEqual([]);
    }
  });
});
