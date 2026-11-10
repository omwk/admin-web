<script lang="ts" setup>
import type { UserStatus } from '#/api/model/admin-user';

import { computed, onMounted, onUnmounted } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';

import { useUserList } from './use-user-list';

defineOptions({ name: 'SystemUserList' });

const {
  changePage,
  dispose,
  error,
  keyword,
  load,
  loading,
  page,
  pageSize,
  reset,
  search,
  status,
  total,
  users,
} = useUserList();
const statusLabels: Record<UserStatus, string> = {
  active: '启用',
  disabled: '停用',
  locked: '锁定',
};
const statusColors: Record<UserStatus, string> = {
  active: 'success',
  disabled: 'default',
  locked: 'warning',
};
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  label,
  value,
}));
const columns = [
  { dataIndex: 'id', title: 'ID', width: 90 },
  { dataIndex: 'username', title: '用户名', width: 160 },
  { dataIndex: 'nickname', title: '昵称', width: 160 },
  { dataIndex: 'email', title: '邮箱', width: 220 },
  { dataIndex: 'dept_id', title: '部门 ID', width: 100 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'updated_at', title: '更新时间', width: 180 },
];
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
  total: total.value,
}));
function handleTableChange(value: { current?: number; pageSize?: number }) {
  void changePage(value.current ?? 1, value.pageSize ?? pageSize.value);
}
function demonstrateCreate() {
  message.info('当前版本仅支持查看用户');
}
onMounted(load);
onUnmounted(dispose);
</script>

<template>
  <Page title="用户管理" description="查看用户信息，关键词和状态筛选暂未开放。">
    <Card title="用户列表">
      <template #extra>
        <Button
          v-if="hasPermission('system:user:create')"
          type="primary"
          @click="demonstrateCreate"
        >
          新增用户
        </Button>
      </template>
      <form
        class="mb-4 flex flex-wrap items-center gap-3"
        @submit.prevent="search"
      >
        <label for="user-keyword">关键词</label>
        <Input
          id="user-keyword"
          v-model:value="keyword"
          class="!w-60"
          allow-clear
          placeholder="用户名、昵称或邮箱"
        />
        <label for="user-status">状态</label>
        <Select
          id="user-status"
          v-model:value="status"
          class="!w-36"
          :options="statusOptions"
          allow-clear
          placeholder="全部状态"
        />
        <Space>
          <Button type="primary" html-type="submit" :loading="loading">
            查询
          </Button>
          <Button :disabled="loading" @click="reset">重置</Button>
        </Space>
      </form>
      <Alert v-if="error" class="mb-4" type="error" show-icon :message="error">
        <template #action>
          <Button size="small" @click="load">重试</Button>
        </template>
      </Alert>
      <Table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1290 }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <Tag
            v-if="column.dataIndex === 'status'"
            :color="statusColors[record.status as UserStatus]"
          >
            {{ statusLabels[record.status as UserStatus] || '未知' }}
          </Tag>
          <template
            v-else-if="
              column.dataIndex === 'created_at' ||
              column.dataIndex === 'updated_at'
            "
          >
            {{ formatDateTime(text) }}
          </template>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
