import { createApp, nextTick } from 'vue';

import { describe, expect, it, vi } from 'vitest';

import DictionaryForm from '../dictionary-form.vue';

const api = vi.hoisted(() => ({ update: vi.fn(), meta: vi.fn() }));
vi.mock('#/auth/permission', () => ({ hasPermission: () => true }));
vi.mock('#/api/core/dictionaries', () => ({
  updateDictionaryApi: api.update,
  createDictionaryApi: vi.fn(),
  getMetaDictionaryApi: api.meta,
}));
describe('system dictionary maintenance bootstrap', () => {
  it('edits the name while locking the type and uses local status options without metadata', async () => {
    const root = document.createElement('div');
    document.body.append(root);
    const dictionary = {
      id: 1,
      name: '用户状态',
      type: 'user_status',
      scope: 'system' as const,
      status: 'disabled' as const,
      builtin: false,
      tenant_id: 1,
    };
    api.update.mockResolvedValueOnce({ ...dictionary, name: '账号状态' });
    const app = createApp(DictionaryForm, { dictionary });
    app.mount(root);
    try {
      const type = document.querySelector<HTMLInputElement>(
        '[aria-label="字典类型"]',
      );
      const name = document.querySelector<HTMLInputElement>(
        '[aria-label="字典名称"]',
      );
      if (!type || !name) throw new Error('Missing dictionary fields');
      expect(type.disabled).toBe(true);
      expect(name.disabled).toBe(false);
      expect(document.body.textContent).toContain('停用');
      expect(document.body.textContent).toContain('系统字典的码值由代码定义');
      name.value = '账号状态';
      name.dispatchEvent(new Event('input', { bubbles: true }));
      const form = document.querySelector('form');
      if (!form) throw new Error('Missing dictionary form');
      form.dispatchEvent(
        new Event('submit', { bubbles: true, cancelable: true }),
      );
      await vi.waitFor(() =>
        expect(api.update).toHaveBeenCalledWith(1, {
          type: 'user_status',
          name: '账号状态',
          status: 'disabled',
        }),
      );
      expect(api.meta).not.toHaveBeenCalled();
    } finally {
      app.unmount();
      root.remove();
      await nextTick();
    }
  });
});
