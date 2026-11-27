<script setup lang="ts">
import type { GatewayDateRange } from '../shared/gateway-time';

import type {
  GatewayCallSummary,
  GatewaySummaryQuery,
} from '#/api/model/gateway';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Radio,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getGatewayCallSummaryApi } from '#/api/core/gateway';
import { hasPermission } from '#/auth/permission';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { gatewayErrorMessage } from '../shared/gateway-error';
import {
  formatGatewayCost,
  formatGatewayRate,
  gatewayRangeQuery,
  validateGatewayRange,
} from '../shared/gateway-time';

defineOptions({ name: 'OpenPlatformUsage' });
const allowed = computed(() => hasPermission('gateway:call:read'));
const range = ref<GatewayDateRange>([dayjs().subtract(24, 'hour'), dayjs()]);
const groupBy = ref<GatewaySummaryQuery['group_by']>('client');
const summary = ref<GatewayCallSummary>();
const loading = ref(false);
const error = ref('');
let appliedRange = range.value;
let sequence = 0;
const columns = [
  { dataIndex: 'key', title: '分组', width: 280 },
  { dataIndex: 'calls', title: '调用量', width: 150 },
  { dataIndex: 'success_rate', title: '成功率', width: 150 },
  { dataIndex: 'p95_latency_ms', title: 'P95 耗时', width: 150 },
  { dataIndex: 'cost_cents', title: '费用', width: 150 },
];
const groupOptions = [
  { label: '客户端', value: 'client' },
  { label: '路由', value: 'route' },
  { label: '日期', value: 'day' },
];

async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getGatewayCallSummaryApi({
      ...gatewayRangeQuery(appliedRange),
      group_by: groupBy.value,
    });
    if (current === sequence) summary.value = result;
  } catch (error_) {
    if (current === sequence) {
      summary.value = undefined;
      error.value = gatewayErrorMessage(error_);
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

async function search() {
  const rangeError = validateGatewayRange(range.value);
  if (rangeError) {
    error.value = rangeError;
    return;
  }
  appliedRange = [...range.value];
  await load();
}

async function changeGroup(value: GatewaySummaryQuery['group_by']) {
  groupBy.value = value;
  await load();
}

onMounted(() => {
  if (allowed.value) void load();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="用量统计"
    description="查看 API 调用量、成功率、耗时和费用。"
  >
    <Card data-testid="gateway-usage-page">
      <form
        class="mb-4 flex flex-wrap items-end gap-3"
        @submit.prevent="search"
      >
        <div>
          <label class="mb-1 block">时间范围</label>
          <DatePicker.RangePicker
            v-model:value="range"
            show-time
            format="YYYY-MM-DD HH:mm:ss"
            :input-read-only="false"
            :allow-clear="false"
          />
        </div>
        <Button type="primary" html-type="submit" :loading="loading">
          查询
        </Button>
        <Radio.Group
          :value="groupBy"
          button-style="solid"
          :options="groupOptions"
          option-type="button"
          aria-label="统计分组"
          @change="changeGroup($event.target.value)"
        />
      </form>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="search">重试</Button>
        </template>
      </Alert>
      <div v-if="summary" class="mb-3 text-sm text-muted-foreground">
        总调用量 {{ summary.total_calls }}
      </div>
      <Table
        row-key="key"
        data-testid="gateway-usage-list"
        :columns="columns"
        :data-source="summary?.items ?? []"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 900 }"
      >
        <template #emptyText>
          <Empty v-if="!loading && !error" description="所选范围内没有调用" />
          <span v-else>{{ error ? '统计加载失败，请重试' : '正在加载' }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'key'">
            {{
              groupBy === 'day'
                ? dayjs(record.key).format('YYYY-MM-DD')
                : record.key
            }}
          </template>
          <template v-else-if="column.dataIndex === 'success_rate'">
            {{ formatGatewayRate(record.success_rate) }}
          </template>
          <template v-else-if="column.dataIndex === 'p95_latency_ms'">
            {{ record.p95_latency_ms }} ms
          </template>
          <template v-else-if="column.dataIndex === 'cost_cents'">
            {{ formatGatewayCost(record.cost_cents) }}
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
