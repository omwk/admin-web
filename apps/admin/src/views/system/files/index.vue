<script setup lang="ts">
import type { LibraryFile } from '#/api/model/storage';

import { computed } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Select,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';
import { platformTenantId } from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';

import FileUpload from './file-upload.vue';
import { fileSize, fileType, purposeOptions } from './options';
import { useFilePage } from './use-file-page';

defineOptions({ name: 'SystemFiles' });
const {
  allowed,
  rows,
  loading,
  busy,
  error,
  filters,
  highlighted,
  pagination,
  load,
  query,
  reset,
  changePage,
  uploaded,
  download,
  copy,
  remove,
} = useFilePage();
const canConfigure = computed(
  () =>
    useUserStore().userInfo?.tenantId === platformTenantId &&
    hasPermission('system:storage:manage'),
);
const columns = [
  { title: '文件名', dataIndex: 'original_name', width: 260, ellipsis: true },
  { title: '类型', dataIndex: 'mime', width: 100 },
  { title: '大小', dataIndex: 'size_bytes', width: 110 },
  { title: '用途', dataIndex: 'purpose', width: 90 },
  { title: '上传人', dataIndex: 'uploader', width: 100 },
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '操作', dataIndex: 'actions', width: 230 },
];
</script>

<template>
  <Page
    title="文件管理"
    description="上传、筛选和管理文件，分享链接有效期为 5 分钟。"
  >
    <Card data-testid="files-page">
      <FileUpload
        v-if="allowed"
        :can-configure="canConfigure"
        @uploaded="uploaded"
      />
      <Alert
        v-if="!allowed"
        message="暂无文件管理权限，请联系管理员"
        type="info"
        show-icon
        class="mb-4"
      />
      <form
        class="mb-4 flex flex-wrap items-center gap-3"
        @submit.prevent="query"
      >
        <label class="flex items-center gap-2">
          用途
          <Select
            v-model:value="filters.purpose"
            aria-label="筛选用途"
            :options="purposeOptions"
            placeholder="全部"
            allow-clear
            class="w-28"
            :disabled="loading || busy || !allowed"
          />
        </label>
        <label class="flex items-center gap-2 whitespace-nowrap">
          关键字
          <Input
            v-model:value="filters.keyword"
            aria-label="文件关键字"
            placeholder="按文件名搜索"
            :maxlength="256"
            :disabled="loading || busy || !allowed"
            class="w-52"
            allow-clear
          />
        </label>
        <Button html-type="submit" :disabled="loading || busy || !allowed">
          查询
        </Button>
        <Button :disabled="loading || busy || !allowed" @click="reset">
          重置
        </Button>
        <Button :disabled="busy || !allowed" @click="load">刷新</Button>
      </form>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="load">重试</Button>
        </template>
      </Alert>
      <Table
        row-key="id"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1180 }"
        :row-class-name="
          (record) => (record.id === highlighted ? 'file-new' : '')
        "
        @change="changePage"
      >
        <template #emptyText>
          <Empty
            v-if="!loading && !error"
            :description="allowed ? '暂无文件' : '暂无可查看的文件'"
          >
            <p class="text-muted-foreground">
              {{
                allowed
                  ? '上传第一个文件，或调整筛选条件。未配置对象存储时请联系平台管理员。'
                  : '获得文件管理权限后可在此查看文件。'
              }}
            </p>
            <RouterLink
              v-if="canConfigure"
              to="/system/storage"
              class="text-primary"
            >
              前往存储配置
            </RouterLink>
          </Empty>
          <span v-else>{{ error ? '文件加载失败，请重试' : '正在加载' }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'original_name'">
            <Tooltip :title="record.original_name">
              <span>{{ record.original_name }}</span>
            </Tooltip>
            <Tag v-if="record.id === highlighted" color="green" class="ml-2">
              新上传
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'mime'">
            {{ fileType(record as LibraryFile) }}
          </template>
          <template v-else-if="column.dataIndex === 'size_bytes'">
            {{ fileSize(record.size_bytes) }}
          </template>
          <template v-else-if="column.dataIndex === 'purpose'">
            {{
              purposeOptions.find((option) => option.value === record.purpose)
                ?.label ?? record.purpose
            }}
          </template>
          <template v-else-if="column.dataIndex === 'uploader'">
            <Tooltip title="文件接口暂未提供上传人信息">—</Tooltip>
          </template>
          <template v-else-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(record.created_at) }}
          </template>
          <div v-else-if="column.dataIndex === 'actions'" class="flex gap-1">
            <Button
              size="small"
              :disabled="busy"
              @click="download(record as LibraryFile)"
            >
              下载
            </Button>
            <Button
              size="small"
              :disabled="busy"
              @click="copy(record as LibraryFile)"
            >
              复制链接
            </Button>
            <Button
              v-if="allowed"
              size="small"
              danger
              :disabled="busy"
              @click="remove(record as LibraryFile)"
            >
              删除
            </Button>
          </div>
        </template>
      </Table>
    </Card>
  </Page>
</template>

<style scoped>
:deep(.file-new > td) {
  background: hsl(var(--accent));
}
</style>
