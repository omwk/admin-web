import type { PageResult } from '#/api/model/response';

import { computed, onUnmounted, ref, shallowRef } from 'vue';

import { notificationError } from '#/api/notification-safety';

export function useNotificationPage<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PageResult<T>>,
) {
  const rows = shallowRef<T[]>([]);
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const loading = ref(false);
  const error = ref('');
  let sequence = 0;
  const pagination = computed(() => ({
    current: page.value,
    pageSize: pageSize.value,
    total: total.value,
    pageSizeOptions: ['10', '20', '50', '100'],
    showSizeChanger: true,
    showTotal: (count: number) => `共 ${count} 条`,
  }));
  async function load(reset = false): Promise<void> {
    if (reset) page.value = 1;
    const request = ++sequence;
    loading.value = true;
    error.value = '';
    try {
      const result = await fetchPage(page.value, pageSize.value);
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
      if (request === sequence) {
        rows.value = [];
        total.value = 0;
        error.value = notificationError(error_);
      }
    } finally {
      if (request === sequence) loading.value = false;
    }
  }
  async function changePage(value: { current?: number; pageSize?: number }) {
    page.value =
      value.pageSize && value.pageSize !== pageSize.value
        ? 1
        : (value.current ?? 1);
    pageSize.value = value.pageSize ?? pageSize.value;
    await load();
  }
  onUnmounted(() => sequence++);
  return { changePage, error, load, loading, pagination, rows };
}
