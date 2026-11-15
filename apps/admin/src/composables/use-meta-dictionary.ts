import type { MaybeRefOrGetter, Ref } from 'vue';

import type { DictionaryOption } from './dictionary-options';

import type { MetaDictionaryItem } from '#/api/model/configuration';

import {
  computed,
  onActivated,
  onMounted,
  onUnmounted,
  ref,
  toValue,
  watch,
} from 'vue';

import { getMetaDictionaryApi } from '#/api/core/dictionaries';
import { toApiError } from '#/api/errors';

export type DictionaryValue = null | number | string | undefined;

interface CacheEntry {
  consumers: number;
  error: Ref<string>;
  expiresAt: number;
  items: Ref<MetaDictionaryItem[]>;
  pending?: Promise<void>;
  sequence: number;
}

const cache = new Map<string, CacheEntry>();
const cacheLifetime = 5 * 60 * 1000;

function entryFor(type: string) {
  let entry = cache.get(type);
  if (!entry) {
    entry = {
      consumers: 0,
      error: ref(''),
      expiresAt: 0,
      items: ref([]),
      sequence: 0,
    };
    cache.set(type, entry);
  }
  return entry;
}

function load(type: string, entry: CacheEntry): Promise<void> {
  if (entry.pending) return entry.pending;
  if (entry.expiresAt > Date.now()) return Promise.resolve();
  const current = ++entry.sequence;
  entry.error.value = '';
  entry.pending = (async () => {
    try {
      const result = await getMetaDictionaryApi(type);
      if (current === entry.sequence) entry.items.value = result;
    } catch (error) {
      if (current === entry.sequence) {
        entry.items.value = [];
        entry.error.value = toApiError(error).message;
      }
    } finally {
      if (current === entry.sequence) {
        // Cache failures too: mounting more rows must not cause a request storm.
        entry.expiresAt = Date.now() + cacheLifetime;
        entry.pending = undefined;
      }
    }
  })();
  return entry.pending;
}

function reset(entry: CacheEntry) {
  entry.sequence++;
  entry.pending = undefined;
  entry.expiresAt = 0;
}

/** Writes refresh all mounted consumers once, including KeepAlive views. */
export function invalidateMetaDictionary(type: string) {
  const entry = cache.get(type);
  if (!entry) return;
  reset(entry);
  if (entry.consumers) void load(type, entry);
}

/** Tenant-specific labels must never survive login, logout or session expiry. */
export function clearMetaDictionaries() {
  cache.forEach((entry) => {
    reset(entry);
    entry.items.value = [];
    entry.error.value = '';
  });
}

export function useMetaDictionary(
  type: MaybeRefOrGetter<string>,
  fallback: DictionaryOption[] = [],
) {
  const entry = computed(() => entryFor(toValue(type)));
  const items = computed(() => entry.value.items.value);
  let mounted = false;
  const read = () => load(toValue(type), entry.value);

  onMounted(() => {
    mounted = true;
    entry.value.consumers++;
    void read();
  });
  onActivated(() => {
    void read();
  });
  watch(
    () => toValue(type),
    (_type, previous) => {
      if (!mounted) return;
      entryFor(previous).consumers--;
      entry.value.consumers++;
      void read();
    },
    { flush: 'sync' },
  );
  onUnmounted(() => {
    mounted = false;
    entry.value.consumers--;
  });

  function item(value: DictionaryValue) {
    return items.value.find((candidate) => candidate.value === String(value));
  }
  return {
    items,
    error: computed(() => entry.value.error.value),
    refresh: () => {
      entry.value.expiresAt = 0;
      return read();
    },
    options: computed(() =>
      items.value.length > 0
        ? items.value.map(({ value, label, color }) => ({
            value,
            label,
            color,
          }))
        : fallback,
    ),
    label: (value: DictionaryValue) =>
      item(value)?.label ??
      (value === null || value === undefined || value === ''
        ? '—'
        : String(value)),
    color: (value: DictionaryValue) => item(value)?.color || undefined,
  };
}
