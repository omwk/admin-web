import { createApp, defineComponent, nextTick } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  invalidateMetaDictionary,
  useMetaDictionary,
} from '../use-meta-dictionary';

const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/core/dictionaries', () => ({ getMetaDictionaryApi: get }));
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  vi.resetAllMocks();
});
function mount() {
  let dictionary!: ReturnType<typeof useMetaDictionary>;
  const root = document.createElement('div');
  const app = createApp(
    defineComponent({
      setup() {
        dictionary = useMetaDictionary('order_status');
        return () => null;
      },
    }),
  );
  app.mount(root);
  cleanups.push(() => app.unmount());
  return dictionary;
}
describe('metadata dictionary consumers', () => {
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
