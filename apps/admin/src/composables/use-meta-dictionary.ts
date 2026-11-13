import type { MetaDictionaryItem } from '#/api/model/configuration';

import { computed, onActivated, onMounted, onUnmounted, ref } from 'vue';

import { getMetaDictionaryApi } from '#/api/core/dictionaries';
import { toApiError } from '#/api/errors';

const consumers = new Map<string, Set<() => void>>();

/** Writes refresh mounted consumers, including views retained by KeepAlive. */
export function invalidateMetaDictionary(type: string) {
  consumers.get(type)?.forEach((refresh) => refresh());
}

export function useMetaDictionary(type: string) {
  const items = ref<MetaDictionaryItem[]>([]);
  const error = ref('');
  let sequence = 0;
  let firstActivation = true;
  async function refresh() {
    const current = ++sequence;
    error.value = '';
    try {
      const result = await getMetaDictionaryApi(type);
      if (current === sequence) items.value = result;
    } catch (error_) {
      if (current === sequence) {
        items.value = [];
        error.value = toApiError(error_).message;
      }
    }
  }
  const reload = () => {
    void refresh();
  };
  onMounted(() => {
    const listeners = consumers.get(type) ?? new Set();
    listeners.add(reload);
    consumers.set(type, listeners);
    reload();
  });
  onActivated(() => {
    if (firstActivation) firstActivation = false;
    else reload();
  });
  onUnmounted(() => {
    sequence++;
    const listeners = consumers.get(type);
    listeners?.delete(reload);
    if (!listeners?.size) consumers.delete(type);
  });
  type DictionaryValue = null | number | string | undefined;
  function item(value: DictionaryValue) {
    return items.value.find((entry) => entry.value === String(value));
  }
  return {
    items,
    error,
    refresh,
    options: computed(() =>
      items.value.map(({ value, label }) => ({ value, label })),
    ),
    label: (value: DictionaryValue) =>
      item(value)?.label ??
      (value === null || value === undefined || value === ''
        ? '—'
        : String(value)),
    color: (value: DictionaryValue) => item(value)?.color || undefined,
  };
}
