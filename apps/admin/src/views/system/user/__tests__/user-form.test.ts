import { createApp, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import UserForm from '../user-form.vue';

const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('#/api/core/admin-users', () => ({
  createUserApi: vi.fn(),
  updateUserApi: update,
}));

describe('user department editing', () => {
  it('changes department through the tree selector and emits a list refresh', async () => {
    const container = document.createElement('div');
    document.body.append(container);
    const saved = vi.fn();
    const app = createApp(UserForm, {
      user: {
        id: 9,
        tenant_id: 1,
        username: 'test',
        dept_id: 11,
        nickname: '原昵称',
        avatar: null,
        email: null,
        status: 'active',
        is_super: false,
        created_at: '',
        updated_at: '',
      },
      departments: [
        { id: 11, name: '甲部门', parent_id: 0, status: 'active' },
        { id: 12, name: '乙部门', parent_id: 0, status: 'active' },
      ],
      onSaved: saved,
    });
    app.mount(container);
    try {
      const name = document.querySelector<HTMLInputElement>(
        '[aria-label="昵称"]',
      );
      const selector = document.querySelector<HTMLElement>(
        '.ant-select-selector',
      );
      if (!name || !selector) throw new Error('Missing user fields');
      name.value = '新昵称';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      selector.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
      await vi.waitFor(() =>
        expect(
          document.querySelectorAll('.ant-select-tree-title'),
        ).toHaveLength(2),
      );
      const department = [
        ...document.querySelectorAll<HTMLElement>('.ant-select-tree-title'),
      ].find((node) => node.textContent === '乙部门');
      if (!department) throw new Error('Missing target department');
      department.click();
      await nextTick();
      const save = document.querySelector<HTMLButtonElement>(
        '.ant-modal-footer .ant-btn-primary',
      );
      if (!save) throw new Error('Missing save button');
      save.click();
      await vi.waitFor(() =>
        expect(update).toHaveBeenCalledWith(9, {
          avatar: null,
          dept_id: 12,
          email: null,
          nickname: '新昵称',
          status: 'active',
        }),
      );
      expect(saved).toHaveBeenCalledOnce();
    } finally {
      app.unmount();
      container.remove();
    }
  });
});
