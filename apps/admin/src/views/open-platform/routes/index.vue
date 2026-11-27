<script setup lang="ts">
import type { GatewayRoute } from '#/api/model/gateway';

import { computed, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Empty, Table, Tag } from 'ant-design-vue';

import { getGatewayRoutesApi } from '#/api/core/gateway';
import { hasPermission } from '#/auth/permission';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { gatewayErrorMessage } from '../shared/gateway-error';
import RouteFormDrawer from './route-form-drawer.vue';

defineOptions({ name: 'OpenPlatformRoutes' });
const allowed = computed(() => hasPermission('gateway:route:list'));
const canCreateRoute = computed(() => hasPermission('gateway:route:create'));
const canUpdateRoute = computed(() => hasPermission('gateway:route:update'));
const rows = ref<GatewayRoute[]>([]);
const loading = ref(false);
const error = ref('');
const formOpen = ref(false);
const editing = ref<GatewayRoute>();
let sequence = 0;
const columns = [
  { dataIndex: 'code', title: 'Code', width: 180 },
  { dataIndex: 'name', title: '名称', width: 180 },
  { dataIndex: 'method_path', title: '方法 / 路径', width: 300 },
  { dataIndex: 'billing_mode', title: '计费模式', width: 170 },
  { dataIndex: 'visibility', title: '可见性', width: 120 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'actions', title: '操作', width: 100 },
];

async function refresh() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const data = await getGatewayRoutesApi();
    if (current === sequence) rows.value = data;
  } catch (error_) {
    if (current === sequence) {
      rows.value = [];
      error.value = gatewayErrorMessage(error_);
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function edit(route?: GatewayRoute) {
  editing.value = route;
  formOpen.value = true;
}

function closeForm() {
  formOpen.value = false;
  editing.value = undefined;
}

onMounted(() => {
  if (allowed.value) void refresh();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="API 路由"
    description="配置开放 API 的能力、可见性和计费规则。"
  >
    <Card data-testid="gateway-routes-page">
      <div class="mb-4 flex items-center justify-between">
        <Button
          v-if="canCreateRoute"
          type="primary"
          :disabled="loading"
          @click="edit()"
        >
          新建路由
        </Button>
        <Button :disabled="loading" @click="refresh">刷新</Button>
      </div>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="refresh">重试</Button>
        </template>
      </Alert>
      <Table
        row-key="id"
        data-testid="gateway-route-list"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1120 }"
      >
        <template #emptyText>
          <Empty v-if="!loading && !error" description="暂无 API 路由">
            <Button v-if="canCreateRoute" type="primary" @click="edit()">
              新建路由
            </Button>
          </Empty>
          <span v-else>{{
            error ? '路由列表加载失败，请重试' : '正在加载'
          }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'code'">
            <code>{{ record.code }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'method_path'">
            <span class="mr-2 font-medium">{{ record.method }}</span>
            <code>{{ record.path }}</code>
          </template>
          <template v-else-if="column.dataIndex === 'billing_mode'">
            <span>{{
              record.billing_mode === 'per_call'
                ? '按量计费'
                : record.billing_mode === 'package'
                  ? '套餐'
                  : '免费'
            }}</span>
            <span
              v-if="record.billing_mode === 'per_call'"
              class="ml-2 text-xs text-muted-foreground"
            >
              {{ record.price_cents }} {{ record.currency }}/次 ·
              {{ record.units_per_call }} 单位
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'visibility'">
            {{ record.visibility === 'public' ? 'Public' : 'Private' }}
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <Tag :color="record.status === 'enabled' ? 'green' : 'default'">
              {{ record.status === 'enabled' ? '启用' : '停用' }}
            </Tag>
          </template>
          <template
            v-else-if="column.dataIndex === 'actions' && canUpdateRoute"
          >
            <Button size="small" @click="edit(record as GatewayRoute)">
              编辑
            </Button>
          </template>
        </template>
      </Table>
    </Card>
    <RouteFormDrawer
      v-if="canCreateRoute || canUpdateRoute"
      :open="formOpen"
      :route="editing"
      @close="closeForm"
      @saved="refresh"
      @conflict="refresh"
    />
  </Page>
</template>
