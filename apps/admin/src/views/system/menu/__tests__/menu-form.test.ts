import { createApp, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import MenuForm from '../menu-form.vue';
import { menuParentOptions } from '../menu-options';

const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('#/api/core/system', () => ({
  createAdminMenuApi: vi.fn(),
  updateAdminMenuApi: update,
}));

describe('menu editing', () => {
  it('excludes the edited subtree from parent choices and disables non-container nodes', () => {
    const options = menuParentOptions(
      [
        {
          id: 1,
          name: '系统',
          type: 'dir',
          children: [
            {
              id: 2,
              name: '编辑中',
              type: 'menu',
              children: [{ id: 3, name: '子菜单', type: 'menu' }],
            },
            { id: 4, name: '按钮', type: 'button' },
          ],
        },
      ],
      2,
    );
    expect(options[0]?.children).toEqual([
      { key: 4, value: 4, title: '按钮', disabled: true, children: undefined },
    ]);
  });

  it('preserves metadata and advanced settings while excluding response identity fields', async () => {
    const menu = {
      id: 8,
      tenant_id: 1,
      parent_id: 0,
      name: '原菜单',
      type: 'menu' as const,
      path: '/example',
      component: '/pending/index.vue',
      icon: null,
      sort: 4,
      visible: false,
      status: 'disabled' as const,
      permission_code: 'trade:order:pii:read',
      redirect: '/example/detail',
      keep_alive: true,
      is_external: false,
      meta: { badge: '保留', nested: { value: true } },
    };
    const container = document.createElement('div');
    document.body.append(container);
    const saved = vi.fn();
    const app = createApp(MenuForm, {
      menu,
      menus: [menu],
      parentId: 0,
      onSaved: saved,
    });
    app.mount(container);
    try {
      const name = document.querySelector<HTMLInputElement>(
        '[aria-label="菜单名称"]',
      );
      if (!name) throw new Error('Missing menu name');
      name.value = '更新名称';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      await nextTick();
      const save = document.querySelector<HTMLButtonElement>(
        '.ant-modal-footer .ant-btn-primary',
      );
      if (!save) throw new Error('Missing save button');
      save.click();
      const { id, tenant_id: _tenant, ...input } = menu;
      await vi.waitFor(() =>
        expect(update).toHaveBeenCalledWith(id, { ...input, name: '更新名称' }),
      );
      expect(saved).toHaveBeenCalledOnce();
    } finally {
      await nextTick();
      app.unmount();
      container.remove();
    }
  });
});
