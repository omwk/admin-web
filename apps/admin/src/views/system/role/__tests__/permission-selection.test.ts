import type { PermissionGroups } from '#/api/model/system';

import { describe, expect, it } from 'vitest';

import {
  filteredPermissionGroups,
  menuGrantIds,
  menuLeafKeys,
  togglePermissionGroup,
} from '../permission-selection';

const groups: PermissionGroups = {
  system: [
    {
      id: 1,
      code: 'system:user:list',
      name: '查看用户',
      module: 'system',
      type: 'api',
    },
    {
      id: 2,
      code: 'system:user:create',
      name: '创建用户',
      module: 'system',
      type: 'api',
    },
  ],
  trade: [
    {
      id: 3,
      code: 'trade:order:list',
      name: '查看订单',
      module: 'trade',
      type: 'api',
    },
  ],
};
describe('permission selection', () => {
  it('searches code/name/module without shrinking the scope of a module toggle', () => {
    const filtered = filteredPermissionGroups(groups, 'CREATE');
    expect(filtered[0]?.matches.map((permission) => permission.id)).toEqual([
      2,
    ]);
    expect(
      togglePermissionGroup([3], filtered[0]?.permissions ?? [], true),
    ).toEqual([3, 1, 2]);
    expect(
      togglePermissionGroup([1, 2, 3], groups.system ?? [], false),
    ).toEqual([3]);
    expect(filteredPermissionGroups(groups, '查看订单')).toHaveLength(1);
  });
  it('does not turn persisted half-checked ancestors into grants for unchecked siblings', () => {
    const menus = [
      {
        id: 1,
        children: [
          { id: 2, children: [] },
          { id: 3, children: [] },
        ],
      },
    ];
    expect(menuLeafKeys(menus, [1, 2])).toEqual([2]);
    expect(menuLeafKeys(menus, [1, 2, 3])).toEqual([2, 3]);
    expect(menuGrantIds(menus, menuLeafKeys(menus, [1, 2]))).toEqual([1, 2]);
  });
});
