<script setup lang="ts">
import type { NotificationDelivery } from '#/api/model/notification';

import {
  Alert,
  Button,
  Empty,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { formatDateTime } from '#/utils/datetime';

import { channelLabel, notificationChannels } from './options';
import {
  deliveryRetryReason,
  deliveryStatuses,
  useDeliveryPage,
} from './use-delivery-page';

const {
  rows,
  loading,
  error,
  pagination,
  changePage,
  busy,
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
} = useDeliveryPage();
const statusOptions = Object.entries(deliveryStatuses).map(
  ([value, status]) => ({
    label: status.label,
    value,
  }),
);
const columns = [
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '模板', dataIndex: 'template_name', width: 180 },
  { title: '渠道', dataIndex: 'channel', width: 90 },
  { title: '收件人（已脱敏）', dataIndex: 'recipient_masked', width: 180 },
  { title: '状态', dataIndex: 'status', width: 100 },
  { title: '尝试次数', dataIndex: 'attempts', width: 100 },
  { title: '失败原因', dataIndex: 'last_error_message', width: 240 },
  { title: '操作', dataIndex: 'actions', width: 90 },
];
function utcTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toISOString();
}
</script>

<template>
  <div data-testid="notification-deliveries">
    <form
      class="mb-4 flex flex-wrap items-center gap-3"
      @submit.prevent="query"
    >
      <label class="flex items-center gap-2">
        状态
        <Select
          v-model:value="filters.status"
          aria-label="投递状态"
          placeholder="全部"
          :options="statusOptions"
          :disabled="busy"
          class="w-32"
          allow-clear
        />
      </label>
      <label class="flex items-center gap-2">
        渠道
        <Select
          v-model:value="filters.channel"
          aria-label="投递渠道"
          placeholder="全部"
          :options="notificationChannels"
          :disabled="busy"
          class="w-32"
          allow-clear
        />
      </label>
      <label class="flex items-center gap-2">
        模板
        <Select
          v-model:value="filters.template_code"
          aria-label="投递模板"
          placeholder="全部"
          :options="templateOptions"
          :loading="templatesLoading"
          :disabled="busy"
          option-filter-prop="label"
          class="w-72"
          allow-clear
          show-search
        />
      </label>
      <Button type="primary" html-type="submit" :disabled="busy">查询</Button>
      <Button :disabled="busy" @click="reset">重置</Button>
      <Button :disabled="busy" @click="refresh()">刷新</Button>
    </form>
    <Alert
      v-if="stalled.length > 0"
      :message="`有 ${stalled.length} 条投递长时间未发送，可能是 worker 未启动。`"
      type="warning"
      show-icon
      class="mb-4"
      data-testid="stalled-deliveries"
    >
      <template #action>
        <Button
          :loading="retrying === 'stalled'"
          :disabled="busy"
          @click="retryBatch('stalled')"
        >
          全部重新入队
        </Button>
      </template>
    </Alert>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <div class="mb-4 flex items-center gap-3">
      <Button
        :loading="retrying === 'selected'"
        :disabled="busy || selectedIds.length === 0"
        @click="retryBatch('selected')"
      >
        批量重试
      </Button>
      <span class="text-gray-500">已选择 {{ selectedIds.length }} 条</span>
    </div>
    <Table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :row-selection="rowSelection"
      :scroll="{ x: 1250 }"
      :custom-row="
        (record: NotificationDelivery) => ({
          class: '',
          'data-delivery-id': record.id,
        })
      "
      @change="changePage"
    >
      <template #emptyText>
        <Empty>
          <template #description>
            <div>暂无投递记录</div>
            <div class="mt-1 text-gray-500">通知触发后会出现在这里</div>
          </template>
        </Empty>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'created_at'">
          <Tooltip :title="`${utcTime(record.created_at)}（UTC）`">
            <span>{{ formatDateTime(record.created_at) }}</span>
          </Tooltip>
        </template>
        <template v-else-if="column.dataIndex === 'template_name'">
          <Tooltip :title="record.template_code">
            <span>{{ record.template_name || record.template_code }}</span>
          </Tooltip>
        </template>
        <template v-else-if="column.dataIndex === 'channel'">
          {{ channelLabel(record.channel) }}
        </template>
        <template v-else-if="column.dataIndex === 'recipient_masked'">
          <span class="break-all">{{ record.recipient_masked || '—' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <Tag
            :color="
              deliveryStatuses[record.status as NotificationDelivery['status']]
                .color
            "
          >
            {{
              deliveryStatuses[record.status as NotificationDelivery['status']]
                .label
            }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'last_error_message'">
          <Tooltip :title="record.last_error || undefined">
            <span class="break-all">
              {{ record.last_error_message || record.last_error || '—' }}
            </span>
          </Tooltip>
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Tooltip
            :title="
              deliveryRetryReason(record as NotificationDelivery, now) ||
              undefined
            "
          >
            <span>
              <Button
                type="link"
                :loading="retrying === record.id"
                :disabled="
                  busy ||
                  !!deliveryRetryReason(record as NotificationDelivery, now)
                "
                @click="retry(record as NotificationDelivery)"
              >
                重试
              </Button>
            </span>
          </Tooltip>
        </template>
      </template>
    </Table>
  </div>
</template>
