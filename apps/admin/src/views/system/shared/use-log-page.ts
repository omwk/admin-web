import type { LogFilters } from './log-filters';

import type { PageResult } from '#/api/model/response';

import { computed, onUnmounted, reactive, ref, shallowRef } from 'vue';

import { isCancel } from '@vben/request';

import { toApiError } from '#/api/errors';

/** Keep submitted filters separate from the filter form while paging/refreshing. */
export function useLogPage<T>(
  fetchPage: (
    filters: LogFilters,
    page: number,
    pageSize: number,
  ) => Promise<PageResult<T>>,
) {
  const filters = reactive<LogFilters>({});
  const rows = shallowRef<T[]>([]);
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const loading = ref(false);
  const error = ref('');
  let applied: LogFilters = {};
  let sequence = 0;
  const pagination = computed(() => ({
    current: page.value,
    pageSize: pageSize.value,
    total: total.value,
    pageSizeOptions: ['10', '20', '50', '100'],
    showSizeChanger: true,
    showTotal: (count: number) => `共 ${count} 条`,
  }));

  async function load(): Promise<void> {
    const request = ++sequence;
    loading.value = true;
    error.value = '';
    try {
      const result = await fetchPage(applied, page.value, pageSize.value);
      if (request !== sequence) return;
      const lastPage = Math.max(1, Math.ceil(result.total / pageSize.value));
      if (page.value > lastPage) {
        page.value = lastPage;
        await load();
        return;
      }
      rows.value = result.list ?? [];
      total.value = result.total;
    } catch (error_) {
      if (request !== sequence || isCancel(error_)) return;
      rows.value = [];
      total.value = 0;
      error.value = toApiError(error_).message;
    } finally {
      if (request === sequence) loading.value = false;
    }
  }
  async function search() {
    if (
      filters.range &&
      (!filters.range[0].isValid() ||
        !filters.range[1].isValid() ||
        filters.range[0].isAfter(filters.range[1]))
    ) {
      error.value = '开始时间不能晚于结束时间，请检查时间范围';
      return;
    }
    if (
      filters.identity !== null &&
      filters.identity !== undefined &&
      (!Number.isSafeInteger(filters.identity) || filters.identity <= 0)
    ) {
      error.value = '用户 ID 必须为正整数';
      return;
    }
    applied = {
      ...filters,
      ...(filters.range
        ? {
            range: [...filters.range] as [
              (typeof filters.range)[0],
              (typeof filters.range)[1],
            ],
          }
        : {}),
    };
    page.value = 1;
    await load();
  }
  async function reset() {
    delete filters.action;
    delete filters.identity;
    delete filters.range;
    delete filters.resourceType;
    delete filters.result;
    await search();
  }
  async function changePage(value: { current?: number; pageSize?: number }) {
    const size = Math.min(100, Math.max(1, value.pageSize ?? pageSize.value));
    page.value =
      size === pageSize.value
        ? Math.min(10_000, Math.max(1, value.current ?? 1))
        : 1;
    pageSize.value = size;
    await load();
  }
  onUnmounted(() => sequence++);
  return {
    changePage,
    error,
    filters,
    load,
    loading,
    pagination,
    reset,
    rows,
    search,
  };
}
