<script setup lang="ts">
import type { GatewayDateRange } from '../shared/gateway-time';

import type {
  GatewayCall,
  GatewayClient,
  GatewayRoute,
} from '#/api/model/gateway';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  DatePicker,
  Empty,
  Input,
  Select,
  Table,
  Tag,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getGatewayCallsApi,
  getGatewayClientsApi,
  getGatewayRoutesApi,
} from '#/api/core/gateway';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { gatewayErrorMessage } from '../shared/gateway-error';
import {
  formatGatewayCost,
  gatewayRangeQuery,
  validateGatewayRange,
} from '../shared/gateway-time';
import CallDetailDrawer from './call-detail-drawer.vue';

defineOptions({ name: 'OpenPlatformCalls' });
const allowed = computed(() => hasPermission('gateway:call:read'));
const rows = ref<GatewayCall[]>([]);
const clients = ref<GatewayClient[]>([]);
const routes = ref<GatewayRoute[]>([]);
const range = ref<GatewayDateRange>([dayjs().subtract(24, 'hour'), dayjs()]);
const clientId = ref<number>();
const routeId = ref<number>();
const status = ref<'failed' | 'success'>();
const traceId = ref('');
const selectedCall = ref<GatewayCall>();
const detailOpen = ref(false);
const loading = ref(false);
const lookupError = ref('');
const error = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
let applied = {
  client_id: undefined as number | undefined,
  from: range.value[0].toISOString(),
  route_id: undefined as number | undefined,
  status: undefined as 'failed' | 'success' | undefined,
  to: range.value[1].toISOString(),
  trace_id: undefined as string | undefined,
};
let sequence = 0;

const columns = [
  { dataIndex: 'called_at', title: '时间', width: 190 },
  { dataIndex: 'client_name', title: '客户端', width: 180 },
  { dataIndex: 'route_code', title: '路由', width: 170 },
  { dataIndex: 'method_path', title: '方法 / 路径', width: 280 },
  { dataIndex: 'status_code', title: '状态码', width: 100 },
  { dataIndex: 'latency_ms', title: '耗时', width: 100 },
  { dataIndex: 'billing', title: '计费', width: 150 },
  { dataIndex: 'cost_cents', title: '费用', width: 130 },
  { dataIndex: 'actions', title: '操作', width: 90 },
];
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
  total: total.value,
}));

async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getGatewayCallsApi({
      ...applied,
      page: page.value,
      page_size: pageSize.value,
    });
    if (current === sequence) {
      rows.value = result.list;
      total.value = result.total;
      page.value = result.page;
      pageSize.value = result.page_size;
    }
  } catch (error_) {
    if (current === sequence) {
      rows.value = [];
      total.value = 0;
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
  applied = {
    ...gatewayRangeQuery(range.value),
    client_id: clientId.value,
    route_id: routeId.value,
    status: status.value,
    trace_id: traceId.value.trim() || undefined,
  };
  page.value = 1;
  await load();
}

async function reset() {
  clientId.value = undefined;
  routeId.value = undefined;
  status.value = undefined;
  traceId.value = '';
  range.value = [dayjs().subtract(24, 'hour'), dayjs()];
  await search();
}

async function changePage(value: { current?: number; pageSize?: number }) {
  const size = Math.min(100, Math.max(1, value.pageSize ?? pageSize.value));
  page.value = size === pageSize.value ? Math.max(1, value.current ?? 1) : 1;
  pageSize.value = size;
  await load();
}

function showDetails(call: GatewayCall) {
  selectedCall.value = call;
  detailOpen.value = true;
}

onMounted(() => {
  if (!allowed.value) return;
  void Promise.allSettled([getGatewayClientsApi(), getGatewayRoutesApi()]).then(
    (results) => {
      if (results[0].status === 'fulfilled') clients.value = results[0].value;
      if (results[1].status === 'fulfilled') routes.value = results[1].value;
      lookupError.value = results
        .filter((result) => result.status === 'rejected')
        .map((result) =>
          result.status === 'rejected'
            ? gatewayErrorMessage(result.reason)
            : '',
        )
        .join('；');
    },
  );
  applied = { ...applied, ...gatewayRangeQuery(range.value) };
  void load();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="调用日志"
    description="按客户端、路由、状态和 trace 查询调用记录。"
  >
    <Card data-testid="gateway-calls-page">
      <form
        class="mb-4 flex flex-wrap items-end gap-3"
        @submit.prevent="search"
      >
        <div class="w-48">
          <label for="gateway-call-client" class="mb-1 block">客户端</label>
          <Select
            id="gateway-call-client"
            v-model:value="clientId"
            class="w-full"
            allow-clear
            placeholder="全部客户端"
            :options="
              clients.map((client: GatewayClient) => ({
                label: client.name,
                value: client.id,
              }))
            "
          />
        </div>
        <div class="w-48">
          <label for="gateway-call-route" class="mb-1 block">路由</label>
          <Select
            id="gateway-call-route"
            v-model:value="routeId"
            class="w-full"
            allow-clear
            placeholder="全部路由"
            :options="
              routes.map((route: GatewayRoute) => ({
                label: route.code,
                value: route.id,
              }))
            "
          />
        </div>
        <div class="w-32">
          <label for="gateway-call-status" class="mb-1 block">状态</label>
          <Select
            id="gateway-call-status"
            v-model:value="status"
            class="w-full"
            allow-clear
            placeholder="全部状态"
            :options="[
              { label: '成功', value: 'success' },
              { label: '失败', value: 'failed' },
            ]"
          />
        </div>
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
        <div class="w-64">
          <label for="gateway-call-trace" class="mb-1 block">Trace ID</label>
          <Input
            id="gateway-call-trace"
            v-model:value="traceId"
            allow-clear
            placeholder="精确查询"
            :maxlength="128"
          />
        </div>
        <div class="flex gap-2">
          <Button type="primary" html-type="submit" :loading="loading">
            查询
          </Button>
          <Button :disabled="loading" @click="reset">重置</Button>
        </div>
      </form>
      <Alert
        v-if="lookupError"
        :message="lookupError"
        type="warning"
        show-icon
        class="mb-4"
      />
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="load">重试</Button>
        </template>
      </Alert>
      <Table
        row-key="id"
        data-testid="gateway-call-list"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1480 }"
        @change="changePage"
      >
        <template #emptyText>
          <Empty
            v-if="!loading && !error"
            description="当前筛选条件下没有调用记录"
          />
          <span v-else>{{
            error ? '调用日志加载失败，请重试' : '正在加载'
          }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'called_at'">
            {{ formatDateTime(record.called_at) }}
          </template>
          <template v-else-if="column.dataIndex === 'method_path'">
            <span class="mr-2">{{ record.method }}</span>
            <code>{{ record.path }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'status_code'">
            <Tag :color="record.status_code >= 400 ? 'red' : 'green'">
              {{ record.status_code }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'latency_ms'">
            {{ record.latency_ms }} ms
          </template>
          <template v-else-if="column.dataIndex === 'billing'">
            {{
              record.billing_mode === 'per_call'
                ? '按量计费'
                : record.billing_mode === 'package'
                  ? '套餐'
                  : '免费'
            }}
            ·
            {{ record.cost_units }} 单位
          </template>
          <template v-else-if="column.dataIndex === 'cost_cents'">
            {{ formatGatewayCost(record.cost_cents) }}
          </template>
          <Button
            v-else-if="column.dataIndex === 'actions'"
            size="small"
            @click="showDetails(record as GatewayCall)"
          >
            详情
          </Button>
        </template>
      </Table>
    </Card>
    <CallDetailDrawer
      :call="selectedCall"
      :open="detailOpen"
      @close="detailOpen = false"
    />
  </Page>
</template>
