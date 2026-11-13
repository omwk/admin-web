import type { Dictionary } from '#/api/model/configuration';

import { createApp, nextTick } from 'vue';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import DictionaryPage from '../index.vue';

const state = vi.hoisted(() => ({
  get: vi.fn(),
  codes: ['system:dict:update', 'system:dict:create', 'system:dict:delete'],
}));
vi.mock('@vben/common-ui', () => ({
  Page: { template: '<main><slot /></main>' },
}));
vi.mock('#/auth/permission', () => ({
  hasPermission: (code: string) => state.codes.includes(code),
}));
const system: Dictionary = {
  id: 2,
  name: '用户状态',
  type: 'user_status',
  scope: 'system',
  status: 'active',
  builtin: true,
  tenant_id: 1,
};
const business: Dictionary = {
  ...system,
  id: 1,
  name: '订单状态',
  type: 'order_status',
  scope: 'business',
};
vi.mock('#/api/core/dictionaries', () => ({
  getAllDictionariesApi: async (scope: string) =>
    scope === 'system' ? [system] : [business],
  getDictionaryItemsApi: state.get,
  getMetaDictionaryApi: async () => [],
  deleteDictionaryApi: vi.fn(),
  deleteDictionaryItemApi: vi.fn(),
  createDictionaryApi: vi.fn(),
  updateDictionaryApi: vi.fn(),
  createDictionaryItemApi: vi.fn(),
  updateDictionaryItemApi: vi.fn(),
}));
const result = (id: number, label: string) => ({
  list: [
    {
      id,
      label,
      value: `value_${id}`,
      sort: 1,
      status: 'active',
      color: '',
      extra: {},
      builtin: true,
    },
  ],
  total: 1,
  page: 1,
  page_size: 20,
});
let app: ReturnType<typeof createApp>;
let root: HTMLDivElement;
beforeEach(() => {
  state.get.mockReset();
  state.codes = [
    'system:dict:update',
    'system:dict:create',
    'system:dict:delete',
  ];
  state.get.mockImplementation(async (id: number) =>
    result(id, id === 2 ? '用户项' : '订单项'),
  );
  root = document.createElement('div');
  document.body.append(root);
});
afterEach(() => {
  app.unmount();
  root.remove();
});
async function mount() {
  app = createApp(DictionaryPage);
  app.mount(root);
  await vi.waitFor(() =>
    expect(
      root.querySelector('[data-testid="dictionary-items"]')?.textContent,
    ).toContain('用户项'),
  );
  await nextTick();
}
async function select(type: string) {
  const button = root.querySelector<HTMLButtonElement>(
    `[data-dict-type="${type}"] button[aria-pressed]`,
  );
  if (!button) throw new Error('Missing dictionary selector');
  button.click();
  await nextTick();
}
describe('dictionary selection and visibility', () => {
  it('keeps the newly selected dictionary when an older item request finishes later', async () => {
    await mount();
    let resolve!: (value: ReturnType<typeof result>) => void;
    state.get.mockImplementationOnce(
      () =>
        new Promise((done) => {
          resolve = done;
        }),
    );
    await select('order_status');
    expect(
      root.querySelector('[data-testid="dictionary-items"]')?.textContent,
    ).not.toContain('用户项');
    await select('user_status');
    await vi.waitFor(() => expect(root.textContent).toContain('用户项'));
    resolve(result(1, '过期订单项'));
    await nextTick();
    await nextTick();
    expect(
      root.querySelector('[data-testid="dictionary-items"]')?.textContent,
    ).toContain('用户项');
    expect(root.textContent).not.toContain('过期订单项');
  });
  it('hides system create/delete actions and every write action without grants', async () => {
    await mount();
    const right = root.querySelector('[data-testid="dictionary-items"]');
    if (!right) throw new Error('Missing dictionary table');
    expect(right.textContent).not.toContain('新增项');
    expect(
      [...right.querySelectorAll('button')].some(
        (button) => button.textContent?.replaceAll(/\s/g, '') === '删除',
      ),
    ).toBe(false);
    app.unmount();
    state.codes = [];
    await mount();
    const text = [...root.querySelectorAll('button')].map((button) =>
      button.textContent?.replaceAll(/\s/g, ''),
    );
    expect(text).not.toEqual(expect.arrayContaining(['新增业务字典']));
    expect(text).not.toEqual(expect.arrayContaining(['编辑']));
    expect(text).not.toEqual(expect.arrayContaining(['删除字典']));
  });
});
