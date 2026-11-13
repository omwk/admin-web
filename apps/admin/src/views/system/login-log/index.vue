<script setup lang="ts">
import type { LoginLog } from '#/api/model/audit';

import { computed, onMounted } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Table, Tag, Tooltip } from 'ant-design-vue';

import { getLoginLogsApi } from '#/api/core/audit';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { loginQuery } from '../shared/log-filters';
import LogFilters from '../shared/log-filters.vue';
import { useLogPage } from '../shared/use-log-page';

defineOptions({ name: 'SystemLoginLogList' });
const allowed = computed(() => hasPermission('system:audit:list'));
const {
  filters,
  rows,
  loading,
  error,
  pagination,
  load,
  search,
  reset,
  changePage,
} = useLogPage((filters, page, pageSize) =>
  getLoginLogsApi({ ...loginQuery(filters), page, page_size: pageSize }),
);
const columns = [
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '用户', dataIndex: 'username', width: 180 },
  { title: '结果', dataIndex: 'result', width: 90 },
  { title: 'IP', dataIndex: 'ip', width: 180 },
  { title: 'User-Agent', dataIndex: 'user_agent', width: 380 },
];
function userLabel(record: LoginLog) {
  // Never infer an identity from username, resource_id, snapshots or input fields.
  if (
    !Number.isSafeInteger(record.user_id) ||
    (record.user_id ?? 0) <= 0 ||
    record.resource_id === 'unknown'
  )
    return '未知账号';
  return record.username || `用户 #${record.user_id}`;
}
onMounted(() => {
  if (allowed.value) void load();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page v-else title="登录历史" description="查询登录结果和来源信息。">
    <Card>
      <LogFilters
        @update="Object.assign(filters, $event)"
        :filters="filters"
        kind="login"
        :loading="loading"
        @search="search"
        @reset="reset"
        @refresh="load"
      />
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <Table
        data-testid="login-log-list"
        row-key="id"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1020 }"
        @change="changePage"
      >
        <template #emptyText><Empty description="暂无登录记录" /></template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(record.created_at) }}
          </template>
          <template v-else-if="column.dataIndex === 'username'">
            {{ userLabel(record as LoginLog) }}
          </template>
          <template v-else-if="column.dataIndex === 'result'">
            <Tag :color="record.result === 'success' ? 'success' : 'error'">
              {{ record.result === 'success' ? '成功' : '失败' }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'ip'">
            {{ record.ip || '—' }}
          </template>
          <template v-else-if="column.dataIndex === 'user_agent'">
            <Tooltip
              v-if="record.user_agent"
              :title="record.user_agent"
              overlay-class-name="max-w-xl break-all"
            >
              <span class="block max-w-[360px] truncate" tabindex="0">{{
                record.user_agent
              }}</span>
            </Tooltip>
            <span v-else>—</span>
          </template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
