import { createApp, h, nextTick, reactive } from 'vue';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearMetaDictionaries } from '#/composables/use-meta-dictionary';

import DictTag from '../index.vue';

const get = vi.hoisted(() => vi.fn());
vi.mock('#/api/core/dictionaries', () => ({ getMetaDictionaryApi: get }));
const cleanups: (() => void)[] = [];
afterEach(() => {
  cleanups.splice(0).forEach((cleanup) => cleanup());
  clearMetaDictionaries();
  vi.resetAllMocks();
});
function mount(value: string, showDot = false) {
  const props = reactive({
    type: 'product_status',
    value,
    showDot,
    size: 'small' as const,
  });
  const root = document.createElement('div');
  const app = createApp({ render: () => h(DictTag, props) });
  app.mount(root);
  cleanups.push(() => app.unmount());
  return { root, props };
}
describe('dictionary tag', () => {
  it('renders metadata labels and colors with size and dot parameters', async () => {
    get.mockResolvedValueOnce([
      { value: 'active', label: '商品在售', color: 'green' },
    ]);
    const { root } = mount('active', true);
    await vi.waitFor(() => expect(root.textContent).toContain('商品在售'));
    expect(root.querySelector('.ant-tag-green')).not.toBeNull();
    expect(root.querySelector('.text-xs')).not.toBeNull();
    expect(root.querySelector('[aria-hidden="true"]')).not.toBeNull();
  });
  it('immediately renders raw values while loading and when a value is missing', async () => {
    let resolve!: (items: unknown[]) => void;
    get.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { root, props } = mount('future_code');
    expect(root.textContent?.trim()).toBe('future_code');
    resolve([{ value: 'active', label: '在售' }]);
    await nextTick();
    expect(root.textContent?.trim()).toBe('future_code');
    props.value = 'active';
    await vi.waitFor(() => expect(root.textContent?.trim()).toBe('在售'));
  });
  it('renders raw codes when metadata fails without rejecting component setup', async () => {
    get.mockRejectedValueOnce(new Error('HTTP 500'));
    const { root } = mount('archived');
    await nextTick();
    await nextTick();
    expect(root.textContent?.trim()).toBe('archived');
    expect(get).toHaveBeenCalledTimes(1);
  });
});
