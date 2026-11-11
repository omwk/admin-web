import { createApp, nextTick } from 'vue';

import { message } from 'ant-design-vue';
import { describe, expect, it, vi } from 'vitest';

import RoleGrants from '../role-grants.vue';

const setLinks = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('#/auth/permission', () => ({ hasPermission: () => true }));
vi.mock('#/api/core/system', () => ({
  getAdminMenusApi: async () => [],
  getDepartmentsApi: async () => [
    { id: 11, name: '甲部门', children: [] },
    { id: 12, name: '乙部门', children: [] },
  ],
  getPermissionsApi: async () => ({}),
  getRoleApi: async () => ({
    id: 4,
    code: 'test',
    name: '测试角色',
    data_scope: 'custom',
    remark: null,
    status: 'active',
    tenant_id: 1,
  }),
  getRoleLinksApi: async () => [],
  setRoleLinksApi: setLinks,
  updateRoleApi: vi.fn(),
}));

describe('custom department grants', () => {
  it('selects two independent departments and persists both in one grant', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const app = createApp(RoleGrants, {
      role: {
        id: 4,
        tenant_id: 1,
        code: 'test',
        name: '测试角色',
        data_scope: 'custom',
        remark: null,
        status: 'active',
      },
    });
    app.mount(container);
    try {
      await vi.waitFor(() =>
        expect(document.querySelectorAll('.ant-tabs-tab')).toHaveLength(3),
      );
      const tab = [
        ...document.querySelectorAll<HTMLElement>('.ant-tabs-tab'),
      ].find((node) => node.textContent === '数据范围');
      if (!tab) throw new Error('Missing data scope tab');
      tab.click();
      await vi.waitFor(() =>
        expect(
          document.querySelectorAll(
            '[data-testid="role-dept-tree"] .ant-tree-checkbox',
          ),
        ).toHaveLength(2),
      );
      for (const checkbox of document.querySelectorAll<HTMLElement>(
        '[data-testid="role-dept-tree"] .ant-tree-checkbox',
      )) {
        checkbox.click();
        await nextTick();
      }
      const save = [
        ...document.querySelectorAll<HTMLButtonElement>('.ant-drawer button'),
      ].find((node) => node.textContent === '保存数据范围');
      if (!save) throw new Error('Missing save button');
      save.click();
      await vi.waitFor(() =>
        expect(setLinks).toHaveBeenCalledWith(4, 'depts', [11, 12]),
      );
    } finally {
      app.unmount();
      container.remove();
      message.destroy();
    }
  });
});
