<script setup lang="ts">
import type { NotificationDelivery } from '#/api/model/notification';

import { onMounted, ref } from 'vue';

import { Alert, Button, Empty, message, Table, Tag } from 'ant-design-vue';

import {
  getNotificationDeliveriesApi,
  retryNotificationDeliveryApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';
import { formatDateTime } from '#/utils/datetime';

import { channelLabel, deliveryStatuses } from './options';
import { useNotificationPage } from './use-notification-page';

const { rows, loading, error, pagination, load, changePage } =
  useNotificationPage(getNotificationDeliveriesApi);
const retrying = ref<number>();
const actionError = ref('');
const columns = [
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '模板', dataIndex: 'template_code', width: 210 },
  { title: '渠道', dataIndex: 'channel', width: 90 },
  { title: '收件人（已脱敏）', dataIndex: 'recipient', width: 200 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '尝试次数', dataIndex: 'attempts', width: 100 },
  { title: '失败原因', dataIndex: 'last_error', width: 230 },
  { title: '操作', dataIndex: 'actions', width: 90 },
];
async function retry(record: NotificationDelivery) {
  if (retrying.value !== undefined) return;
  retrying.value = record.id;
  actionError.value = '';
  try {
    await retryNotificationDeliveryApi(record.id);
    await load();
    message.success('已提交重试，投递状态已刷新');
  } catch (error_) {
    actionError.value = notificationError(error_);
  } finally {
    retrying.value = undefined;
  }
}
onMounted(() => load());
</script>

<template>
  <div data-testid="notification-deliveries">
    <Button
      :disabled="loading || retrying !== undefined"
      class="mb-4"
      @click="load()"
    >
      刷新
    </Button>
    <Alert
      v-if="error || actionError"
      :message="error || actionError"
      type="error"
      show-icon
      class="mb-4"
    />
    <Table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 1250 }"
      :custom-row="
        (record: NotificationDelivery) => ({
          class: '',
          'data-delivery-id': record.id,
        })
      "
      @change="changePage"
    >
      <template #emptyText><Empty description="暂无投递记录" /></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'created_at'">
          {{ formatDateTime(record.created_at) }}
        </template>
        <template v-else-if="column.dataIndex === 'channel'">
          {{ channelLabel(record.channel) }}
        </template>
        <template v-else-if="column.dataIndex === 'recipient'">
          <div class="break-all text-xs">
            hash：{{ record.recipient_hash || '—' }}
          </div>
          <div class="text-xs text-gray-500">
            域：{{ record.recipient_domain || '—' }}
          </div>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <Tag
            :color="
              deliveryStatuses[record.status as NotificationDelivery['status']]
                ?.color
            "
          >
            {{
              deliveryStatuses[record.status as NotificationDelivery['status']]
                ?.label ?? record.status
            }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'last_error'">
          <span class="break-all">{{ record.last_error || '—' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Button
            v-if="['failed', 'skipped'].includes(record.status)"
            type="link"
            :loading="retrying === record.id"
            :disabled="retrying !== undefined && retrying !== record.id"
            @click="retry(record as NotificationDelivery)"
          >
            重试
          </Button>
        </template>
      </template>
    </Table>
  </div>
</template>
