import type { MaybeRefOrGetter } from 'vue';

import { createApp, defineComponent, nextTick, ref } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  clearMetaDictionaries,
  invalidateMetaDictionary,
  useMetaDictionary,
} from '../use-meta-dictionary';

const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/core/dictionaries', () => ({ getMetaDictionaryApi: get }));
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  clearMetaDictionaries();
  vi.resetAllMocks();
});
function mount(type: MaybeRefOrGetter<string> = 'order_status') {
  let dictionary!: ReturnType<typeof useMetaDictionary>;
  const root = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        dictionary = useMetaDictionary(type);
        return () => null;
      },
    }),
  );
  app.mount(root);
  cleanups.push(() => app.unmount());
  return dictionary;
}
describe('metadata dictionary consumers', () => {
  it('shares one pending request across twenty rows and a subsequent page mount', async () => {
    let resolve!: (items: unknown[]) => void;
    get.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const rows = Array.from({ length: 20 }, () => mount());
    expect(get).toHaveBeenCalledTimes(1);
    expect(rows[0]?.label('paid')).toBe('paid');
    resolve([{ value: 'paid', label: '共享文案', color: 'blue' }]);
    await vi.waitFor(() =>
      expect(rows.every((row) => row.label('paid') === '共享文案')).toBe(true),
    );
    const anotherPage = mount();
    await nextTick();
    expect(anotherPage.label('paid')).toBe('共享文案');
    expect(get).toHaveBeenCalledTimes(1);
    get.mockResolvedValueOnce([{ value: 'paid', label: '保存后的共享文案' }]);
    invalidateMetaDictionary('order_status');
    await vi.waitFor(() =>
      expect(
        rows.every((row) => row.label('paid') === '保存后的共享文案'),
      ).toBe(true),
    );
    expect(get).toHaveBeenCalledTimes(2);
  });

  it('expires after five minutes and clears labels when the authentication context changes', async () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(1000);
    get.mockResolvedValueOnce([{ value: 'paid', label: '缓存文案' }]);
    const first = mount();
    await vi.waitFor(() => expect(first.label('paid')).toBe('缓存文案'));
    now.mockReturnValue(300_999);
    mount();
    expect(get).toHaveBeenCalledTimes(1);
    now.mockReturnValue(301_001);
    get.mockResolvedValueOnce([{ value: 'paid', label: '过期后文案' }]);
    mount();
    await vi.waitFor(() => expect(first.label('paid')).toBe('过期后文案'));
    expect(get).toHaveBeenCalledTimes(2);
    clearMetaDictionaries();
    expect(first.label('paid')).toBe('paid');
    get.mockResolvedValueOnce([{ value: 'paid', label: '新租户文案' }]);
    mount();
    await vi.waitFor(() => expect(first.label('paid')).toBe('新租户文案'));
    expect(get).toHaveBeenCalledTimes(3);
    now.mockRestore();
  });

  it('shares a failed read and keeps raw codes visible without repeated requests', async () => {
    get.mockRejectedValueOnce(new Error('metadata 500'));
    const rows = Array.from({ length: 20 }, () => mount());
    await vi.waitFor(() => expect(rows[0]?.error.value).toBeTruthy());
    expect(rows.every((row) => row.label('future') === 'future')).toBe(true);
    mount();
    expect(get).toHaveBeenCalledTimes(1);
  });

  it('uses metadata options with colors and switches reactive dictionary types', async () => {
    const type = ref('product_status');
    get.mockResolvedValueOnce([
      { value: 'active', label: '在售', color: 'green' },
    ]);
    const dictionary = mount(type);
    await vi.waitFor(() =>
      expect(dictionary.options.value).toEqual([
        { value: 'active', label: '在售', color: 'green' },
      ]),
    );
    get.mockResolvedValueOnce([
      { value: 'active', label: '启用', color: 'blue' },
    ]);
    type.value = 'enable_status';
    await vi.waitFor(() => expect(dictionary.label('active')).toBe('启用'));
    expect(get.mock.calls.map(([value]) => value)).toEqual([
      'product_status',
      'enable_status',
    ]);
  });

  it('renders server labels and raw unknown values, and refreshes live consumers after an edit', async () => {
    get.mockResolvedValueOnce([
      { value: 'paid', label: '已支付（租户）', color: 'green' },
    ]);
    const dictionary = mount();
    await vi.waitFor(() =>
      expect(dictionary.label('paid')).toBe('已支付（租户）'),
    );
    expect(dictionary.label('future_value')).toBe('future_value');
    expect(dictionary.label(null)).toBe('—');
    expect(dictionary.color('paid')).toBe('green');
    get.mockResolvedValueOnce([
      { value: 'paid', label: '新的支付文案', color: '' },
    ]);
    invalidateMetaDictionary('order_status');
    await vi.waitFor(() =>
      expect(dictionary.label('paid')).toBe('新的支付文案'),
    );
    expect(get).toHaveBeenCalledWith('order_status');
  });

  it('discards an older response when a dictionary write triggers a newer read', async () => {
    let resolve!: (items: unknown[]) => void;
    get.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const dictionary = mount();
    get.mockResolvedValueOnce([{ value: 'paid', label: '最新文案' }]);
    invalidateMetaDictionary('order_status');
    await vi.waitFor(() => expect(dictionary.label('paid')).toBe('最新文案'));
    resolve([{ value: 'paid', label: '旧文案' }]);
    await nextTick();
    await nextTick();
    expect(dictionary.label('paid')).toBe('最新文案');
  });
});
