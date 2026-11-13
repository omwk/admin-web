import type { DictionaryItem } from '#/api/model/configuration';

import { createApp } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import ItemForm from '../item-form.vue';

const update = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock('#/auth/permission', () => ({ hasPermission: () => true }));
vi.mock('#/api/core/dictionaries', () => ({
  getMetaDictionaryApi: async () => [],
  updateDictionaryItemApi: update,
  createDictionaryItemApi: vi.fn(),
}));
describe('system dictionary display edits', () => {
  it('saves label and sort while preserving machine identity, status, color and extra', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const item: DictionaryItem = {
      id: 2,
      dict_id: 1,
      tenant_id: 1,
      label: '旧标签',
      value: 'active',
      sort: 5,
      status: 'active',
      color: 'green',
      extra: { source: 'preserved' },
      builtin: true,
    };
    const app = createApp(ItemForm, {
      dictionary: {
        id: 1,
        name: '用户状态',
        type: 'user_status',
        scope: 'system',
        status: 'active',
        builtin: true,
        tenant_id: 1,
      },
      item,
    });
    app.mount(root);
    try {
      const input = document.querySelector<HTMLInputElement>(
        '[aria-label="字典项标签"]',
      );
      const value = document.querySelector<HTMLInputElement>(
        '[aria-label="字典项值"]',
      );
      if (!input || !value) throw new Error('Missing dictionary fields');
      expect(value.disabled).toBe(true);
      input.value = '服务端显示标签';
      input.dispatchEvent(new Event('input', { bubbles: true }));
      const form = document.querySelector('form');
      if (!form) throw new Error('Missing dictionary form');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() =>
        expect(update).toHaveBeenCalledWith(2, {
          label: '服务端显示标签',
          value: 'active',
          sort: 5,
          status: 'active',
          color: 'green',
          extra: { source: 'preserved' },
        }),
      );
    } finally {
      app.unmount();
      root.remove();
    }
  });
});
