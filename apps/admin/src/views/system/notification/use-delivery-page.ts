import type {
  NotificationDelivery,
  NotificationDeliveryFilters,
} from '#/api/model/notification';

import {
  computed,
  onMounted,
  onUnmounted,
  reactive,
  ref,
  shallowRef,
} from 'vue';

import { message } from 'ant-design-vue';

import {
  getNotificationDeliveriesApi,
  getNotificationTemplatesApi,
  retryNotificationDeliveriesApi,
  retryNotificationDeliveryApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import { useNotificationPage } from './use-notification-page';

export const deliveryStatuses = {
  pending: { label: '待发送', color: 'orange' },
  sent: { label: '已发送', color: 'green' },
  failed: { label: '失败', color: 'red' },
  skipped: { label: '已跳过', color: 'default' },
};

export function isStalledDelivery(record: NotificationDelivery, now: number) {
  return (
    record.status === 'pending' &&
    record.attempts === 0 &&
    now - Date.parse(record.created_at) > 5 * 60_000
  );
}

export function deliveryRetryReason(record: NotificationDelivery, now: number) {
  if (record.status === 'sent') return '已发送的投递无需重试';
  if (record.status !== 'pending') return '';
  if (record.attempts > 0) return '投递正在处理中，请等待发送结果';
  if (!isStalledDelivery(record, now)) return '待发送不足 5 分钟，请稍后重试';
  if (record.next_retry_at && Date.parse(record.next_retry_at) > now)
    return '投递已安排重试，请等待计划时间';
  return '';
}

export function useDeliveryPage() {
  const filters = reactive<NotificationDeliveryFilters>({});
  let applied: NotificationDeliveryFilters = {};
  const page = useNotificationPage((current, size) =>
    getNotificationDeliveriesApi(current, size, { ...applied }),
  );
  const selectedIds = ref<number[]>([]);
  const retrying = ref<'selected' | 'stalled' | number>();
  const actionError = ref('');
  const pendingError = ref('');
  const templateError = ref('');
  const pendingLoading = ref(false);
  const templatesLoading = ref(false);
  const templateOptions = ref<{ label: string; value: string }[]>([]);
  const pending = shallowRef<NotificationDelivery[]>([]);
  const now = ref(Date.now());
  let pendingSequence = 0;
  let disposed = false;
  let timer: ReturnType<typeof setInterval>;
  const stalled = computed(() =>
    pending.value.filter((record) => isStalledDelivery(record, now.value)),
  );
  const busy = computed(
    () =>
      page.loading.value ||
      pendingLoading.value ||
      retrying.value !== undefined,
  );
  const error = computed(() =>
    [
      page.error.value,
      actionError.value,
      pendingError.value,
      templateError.value,
    ]
      .filter(Boolean)
      .join('；'),
  );
  const rowSelection = computed(() => ({
    selectedRowKeys: selectedIds.value,
    onChange: (keys: (number | string)[]) => {
      selectedIds.value = keys.map(Number);
    },
    getCheckboxProps: () => ({ disabled: busy.value }),
  }));

  async function loadPending() {
    const sequence = ++pendingSequence;
    pendingLoading.value = true;
    pendingError.value = '';
    try {
      const records = new Map<number, NotificationDelivery>();
      for (let current = 1; ; current++) {
        const result = await getNotificationDeliveriesApi(current, 100, {
          status: 'pending',
        });
        if (sequence !== pendingSequence) return;
        for (const record of result.list) records.set(record.id, record);
        if (current * 100 >= result.total || result.list.length === 0) break;
      }
      pending.value = [...records.values()];
      now.value = Date.now();
    } catch (error_) {
      if (sequence !== pendingSequence) return;
      pending.value = [];
      pendingError.value = `卡住投递检查失败：${notificationError(error_)}`;
    } finally {
      if (sequence === pendingSequence) pendingLoading.value = false;
    }
  }

  async function loadTemplates() {
    templatesLoading.value = true;
    templateError.value = '';
    try {
      const options = new Map<string, { label: string; value: string }>();
      for (let current = 1; ; current++) {
        const result = await getNotificationTemplatesApi(current, 100);
        if (disposed) return;
        for (const template of result.list) {
          if (!options.has(template.code) || template.locale === 'zh-CN') {
            options.set(template.code, {
              label: `${template.code} - ${template.subject || template.code}`,
              value: template.code,
            });
          }
        }
        if (current * 100 >= result.total || result.list.length === 0) break;
      }
      templateOptions.value = [...options.values()];
    } catch (error_) {
      if (!disposed)
        templateError.value = `模板筛选加载失败：${notificationError(error_)}`;
    } finally {
      if (!disposed) templatesLoading.value = false;
    }
  }

  async function refresh(reset = false) {
    selectedIds.value = [];
    await Promise.all([page.load(reset), loadPending()]);
  }
  async function query() {
    applied = { ...filters };
    actionError.value = '';
    await refresh(true);
  }
  async function reset() {
    filters.status = undefined;
    filters.channel = undefined;
    filters.template_code = undefined;
    await query();
  }
  async function changePage(value: { current?: number; pageSize?: number }) {
    selectedIds.value = [];
    await page.changePage(value);
  }

  async function retry(record: NotificationDelivery) {
    if (busy.value || deliveryRetryReason(record, Date.now())) return;
    retrying.value = record.id;
    actionError.value = '';
    try {
      await retryNotificationDeliveryApi(record.id);
      message.success('已提交重试，投递状态已刷新');
    } catch (error_) {
      actionError.value = notificationError(error_);
    } finally {
      await refresh();
      retrying.value = undefined;
    }
  }

  async function retryBatch(source: 'selected' | 'stalled') {
    if (busy.value) return;
    const ids =
      source === 'selected'
        ? [...selectedIds.value]
        : stalled.value.map((record) => record.id);
    if (ids.length === 0) return;
    retrying.value = source;
    actionError.value = '';
    let retried = 0;
    let skipped = 0;
    let processed = 0;
    try {
      for (let offset = 0; offset < ids.length; offset += 100) {
        const batch = ids.slice(offset, offset + 100);
        const result = await retryNotificationDeliveriesApi(batch);
        retried += result.retried;
        skipped += result.skipped;
        processed += batch.length;
      }
      message.success(`成功 ${retried} 条，跳过 ${skipped} 条`);
    } catch (error_) {
      actionError.value = `成功 ${retried} 条，跳过 ${skipped} 条，未完成 ${ids.length - processed} 条：${notificationError(error_)}`;
    } finally {
      await refresh();
      retrying.value = undefined;
    }
  }

  onMounted(() => {
    void refresh();
    void loadTemplates();
    timer = setInterval(() => (now.value = Date.now()), 30_000);
  });
  onUnmounted(() => {
    disposed = true;
    pendingSequence++;
    clearInterval(timer);
  });
  return {
    ...page,
    busy,
    changePage,
    error,
    filters,
    now,
    query,
    refresh,
    reset,
    retry,
    retryBatch,
    retrying,
    rowSelection,
    selectedIds,
    stalled,
    templateOptions,
    templatesLoading,
  };
}
