<script setup lang="ts">
import { computed, onMounted } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Card, Empty, Table, Tag } from 'ant-design-vue';

import { getAuditLogsApi } from '#/api/core/audit';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { auditQuery } from '../shared/log-filters';
import LogFilters from '../shared/log-filters.vue';
import { useLogPage } from '../shared/use-log-page';
import JsonDiff from './json-diff.vue';

defineOptions({ name: 'SystemAuditLogList' });
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
  getAuditLogsApi({ ...auditQuery(filters), page, page_size: pageSize }),
);
const columns = [
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '操作者', dataIndex: 'actor_id', width: 150 },
  { title: '动作', dataIndex: 'action', width: 270 },
  { title: '资源', dataIndex: 'resource_id', width: 190 },
  { title: '结果', dataIndex: 'result', width: 90 },
  { title: 'IP', dataIndex: 'ip', width: 160 },
  { title: '内容', dataIndex: 'truncated', width: 140 },
];
const actorTypes: Record<string, string> = {
  user: '用户',
  system: '系统',
  api_client: 'API 客户端',
};
onMounted(() => {
  if (allowed.value) void load();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="审计日志"
    description="查询操作记录，展开查看变更前后的内容。"
  >
    <Card>
      <LogFilters
        @update="Object.assign(filters, $event)"
        :filters="filters"
        kind="audit"
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
        data-testid="audit-log-list"
        row-key="id"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1250 }"
        @change="changePage"
      >
        <template #emptyText>
          <Empty description="当前筛选条件下没有记录" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(record.created_at) }}
          </template>
          <template v-else-if="column.dataIndex === 'actor_id'">
            {{ actorTypes[record.actor_type] || record.actor_type
            }}{{ record.actor_id == null ? '' : ` #${record.actor_id}` }}
          </template>
          <template v-else-if="column.dataIndex === 'resource_id'">
            <span class="break-all">
              {{ record.resource_type }} / {{ record.resource_id }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'result'">
            <Tag :color="record.result === 'success' ? 'success' : 'error'">
              {{ record.result === 'success' ? '成功' : '失败' }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'truncated'">
            <Tag v-if="record.truncated" color="warning"> 内容已截断 </Tag>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.dataIndex === 'ip'">
            {{ record.ip || '—' }}
          </template>
        </template>
        <template #expandedRowRender="{ record }">
          <Alert
            v-if="record.truncated"
            message="内容已截断"
            type="warning"
            show-icon
          />
          <JsonDiff :before="record.before" :after="record.after" />
        </template>
      </Table>
    </Card>
  </Page>
</template>
