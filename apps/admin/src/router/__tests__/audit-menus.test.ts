import type { IdentityMenu } from '#/api/model/menu';

import { describe, expect, it } from 'vitest';

import { auditFallbackRoutes, auditMenus } from '../audit-menus';
import { resolveMenuComponent } from '../component-registry';

const menu = (id: number, path: string): IdentityMenu => ({
  id,
  path,
  name: path,
  parent_id: 0,
  sort: id,
  type: 'menu',
  is_external: false,
  keep_alive: false,
  meta: {},
});
describe('audit menu boundary', () => {
  it('hides both retained grants without permission, including relative child paths', () => {
    const parent = {
      ...menu(1, '/system'),
      type: 'dir' as const,
      children: [
        menu(2, 'audit-logs'),
        menu(3, '/system/login-logs'),
        menu(4, '/system/users'),
      ],
    };
    expect(
      auditMenus([parent], [])[0]?.children?.map((node) => node.id),
    ).toEqual([4]);
    expect(
      auditMenus([parent], ['system:audit:list'])[0]?.children,
    ).toHaveLength(3);
  });
  it('provides hidden forbidden routes and resolves the backend component names', () => {
    expect(auditFallbackRoutes()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: '/system/audit-logs',
          component: '/_core/fallback/forbidden.vue',
          meta: { hideInMenu: true, title: '403' },
        }),
        expect.objectContaining({
          path: '/system/login-logs',
          component: '/_core/fallback/forbidden.vue',
        }),
      ]),
    );
    expect(resolveMenuComponent('system/audit-log/index')).toBe(
      '/system/audit-log/index.vue',
    );
    expect(resolveMenuComponent('system/login-log/index')).toBe(
      '/system/login-log/index.vue',
    );
  });
});
