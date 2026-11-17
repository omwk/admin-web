import type { PermissionGroups } from '#/api/model/system';
import type { TenantTemplate, TenantTemplateRole } from '#/api/model/tenant';

import { describe, expect, it } from 'vitest';

import {
  templateDraft,
  templateMenuTree,
  templatePermissionCodes,
  templatePermissionCount,
  templatePermissionIds,
  validateTemplateDraft,
  validateTemplateRole,
} from '../template-editor-state';

const role: TenantTemplateRole = {
  code: 'reader',
  name: '只读',
  data_scope: 'self',
  status: 'disabled',
  remark: '保留备注',
  permissions: ['catalog:product:list'],
  menus: ['menu:legacy'],
};
const snapshot: TenantTemplate = {
  id: 9,
  code: 'readonly',
  name: '只读版',
  description: '说明',
  roles: [role],
  menus: [],
  permissions: [
    { code: 'unused:resource:list', name: '未授权', module: 'unused' },
  ],
  settings: {},
  created_at: '',
  updated_at: '',
};
const groups: PermissionGroups = {
  catalog: [
    {
      id: 1,
      code: 'catalog:product:list',
      module: 'catalog',
      name: '商品列表',
      type: 'api',
    },
    {
      id: 2,
      code: 'catalog:product:create',
      module: 'catalog',
      name: '商品新增',
      type: 'api',
    },
  ],
};

describe('template draft contracts', () => {
  it('edits a deep copy and preserves status, remark, stable menu keys and permissions', () => {
    const draft = templateDraft(snapshot);
    const first = draft.roles[0];
    if (!first) throw new Error('Missing draft role');
    first.name = '副本';
    first.menus.push('/another');
    first.permissions.push('catalog:product:create');
    expect(role.name).toBe('只读');
    expect(role.menus).toEqual(['menu:legacy']);
    expect(role.permissions).toEqual(['catalog:product:list']);
    expect(draft.roles[0]).toMatchObject({
      status: 'disabled',
      remark: '保留备注',
    });
    expect(Object.keys(draft).toSorted()).toEqual([
      'description',
      'name',
      'roles',
    ]);
  });
  it('counts the union of actual role permissions instead of the snapshot dictionary', () => {
    expect(
      templatePermissionCount({
        ...snapshot,
        roles: [
          role,
          {
            ...role,
            code: 'other',
            permissions: [...role.permissions, 'catalog:product:create'],
          },
        ],
      }),
    ).toBe(2);
    expect(templatePermissionCount({ ...snapshot, roles: [] })).toBe(0);
  });
  it('adapts dictionary IDs without dropping permissions absent from the dictionary', () => {
    expect(
      templatePermissionIds(
        ['catalog:product:list', 'legacy:order:list'],
        groups,
      ),
    ).toEqual([1]);
    expect(
      templatePermissionCodes(
        ['catalog:product:list', 'legacy:order:list'],
        [2],
        groups,
      ),
    ).toEqual(['legacy:order:list', 'catalog:product:create']);
  });
  it('validates duplicate codes, whitespace names, lengths, invalid scopes and the 50-role limit', () => {
    expect(validateTemplateRole('reader', '只读', ['reader'])).toContain(
      '重复',
    );
    expect(validateTemplateRole('bad-code', '只读', [])).toContain('Code');
    expect(validateTemplateRole('reader', '  ', [])).toContain('角色名');
    expect(validateTemplateRole('reader', '名'.repeat(129), [])).toContain(
      '128',
    );
    expect(validateTemplateRole('reader', '📦'.repeat(128), [])).toBe('');
    expect(validateTemplateRole('reader', '📦'.repeat(129), [])).toContain(
      '128',
    );
    expect(
      validateTemplateDraft({
        ...templateDraft(snapshot),
        roles: [role, role],
      }),
    ).toMatchObject({ index: 1, message: expect.stringContaining('重复') });
    expect(
      validateTemplateDraft({
        ...templateDraft(snapshot),
        roles: Array.from({ length: 51 }, () => role),
      })?.message,
    ).toContain('50');
    expect(
      validateTemplateDraft({
        ...templateDraft(snapshot),
        roles: [{ ...role, data_scope: 'invalid' as never }],
      })?.message,
    ).toContain('数据范围');
    expect(
      validateTemplateDraft({ name: '模板', description: '', roles: [] }),
    ).toBeUndefined();
  });
  it.each(['all', 'dept', 'dept_and_child', 'self', 'custom'] as const)(
    'accepts data scope %s',
    (data_scope) => {
      expect(
        validateTemplateDraft({
          ...templateDraft(snapshot),
          roles: [{ ...role, data_scope }],
        }),
      ).toBeUndefined();
    },
  );
  it('builds the immutable tree by stable parent keys, including pathless nodes', () => {
    expect(
      templateMenuTree([
        {
          key: 'child',
          parent_key: 'root',
          name: '无路径',
          path: null,
          type: 'button',
          permission_code: null,
        },
        {
          key: 'root',
          parent_key: '',
          name: '商品',
          path: '/catalog',
          type: 'dir',
          permission_code: null,
        },
      ]),
    ).toEqual([
      {
        key: 'root',
        title: '商品（/catalog）',
        children: [{ key: 'child', title: '无路径', children: [] }],
      },
    ]);
  });
});
