<script setup lang="ts">
import type { AuditLog } from '#/api/model/audit';

import { computed, onMounted } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Badge, Card, Empty, Table, Tag, Tooltip } from 'ant-design-vue';

import { getAuditLogsApi } from '#/api/core/audit';
import { hasPermission } from '#/auth/permission';
import DictTag from '#/components/dict-tag/index.vue';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { auditQuery } from '../shared/log-filters';
import LogFilters from '../shared/log-filters.vue';
import { useLogPage } from '../shared/use-log-page';
import {
  accessedTenantCount,
  actionLabel,
  actorLabel,
  resourceLabel,
  targetTenantLabel,
} from './audit-display';
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
  { title: '操作者', dataIndex: 'actor_id', width: 200 },
  { title: '操作', dataIndex: 'action', width: 300 },
  { title: '对象', dataIndex: 'resource_id', width: 210 },
  { title: '目标租户', dataIndex: 'target_tenant', width: 140 },
  { title: '结果', dataIndex: 'result', width: 110 },
  { title: 'IP', dataIndex: 'ip', width: 160 },
  { title: '内容', dataIndex: 'truncated', width: 140 },
];
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
        :scroll="{ x: 1450 }"
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
            {{ actorLabel(record as AuditLog) }}
          </template>
          <template v-else-if="column.dataIndex === 'action'">
            <Tooltip :title="record.action">
              <span>{{ actionLabel(record.action) }}</span>
            </Tooltip>
          </template>
          <template v-else-if="column.dataIndex === 'resource_id'">
            <span class="break-all">
              {{ resourceLabel(record as AuditLog) }}
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'target_tenant'">
            {{ targetTenantLabel(record.after) }}
          </template>
          <template v-else-if="column.dataIndex === 'result'">
            <Tooltip
              v-if="record.result"
              :title="
                record.result === 'failure' ? record.error_message : undefined
              "
            >
              <span class="inline-flex items-center gap-1">
                <Badge v-if="record.result === 'failure'" status="error" />
                <DictTag type="audit_result" :value="record.result" />
              </span>
            </Tooltip>
            <span v-else>—</span>
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
          <dl
            class="grid gap-2 p-3 text-sm sm:grid-cols-[auto_1fr]"
            data-testid="audit-source"
          >
            <dt>来源 IP</dt>
            <dd>{{ record.ip || '—' }}</dd>
            <dt>User-Agent</dt>
            <dd class="break-all">{{ record.user_agent || '—' }}</dd>
          </dl>
          <dl
            v-if="record.result === 'failure'"
            class="grid gap-2 rounded border border-red-300 p-3 text-sm sm:grid-cols-[auto_1fr]"
            data-testid="audit-failure"
          >
            <dt>错误码（error_code）</dt>
            <dd class="font-mono">{{ record.error_code ?? '—' }}</dd>
            <dt>失败原因（error_message）</dt>
            <dd class="whitespace-pre-wrap break-all">
              {{ record.error_message || '—' }}
            </dd>
          </dl>
          <p
            v-if="accessedTenantCount(record.after) !== undefined"
            class="p-3"
            data-testid="audit-access-scope"
          >
            访问范围：{{ accessedTenantCount(record.after) }} 个租户
          </p>
          <JsonDiff v-else :before="record.before" :after="record.after" />
        </template>
      </Table>
    </Card>
  </Page>
</template>
