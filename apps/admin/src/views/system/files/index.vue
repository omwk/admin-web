<script setup lang="ts">
import type { LibraryFile } from '#/api/model/storage';

import { computed } from 'vue';

import { Page } from '@vben/common-ui';
import { createIconifyIcon } from '@vben/icons';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Empty,
  Input,
  Modal,
  Progress,
  Select,
  Spin,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';
import { platformTenantId } from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';

import FileUpload from './file-upload.vue';
import { categoryLabel, categoryOptions, fileSize } from './options';
import { useFilePage } from './use-file-page';

defineOptions({ name: 'SystemFiles' });
const {
  allowed,
  rows,
  loading,
  busy,
  error,
  usage,
  usageError,
  usagePercent,
  previewFile,
  previewUrl,
  previewLoading,
  previewError,
  filters,
  highlighted,
  pagination,
  load,
  query,
  reset,
  changePage,
  uploaded,
  preview,
  closePreview,
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
  { title: '预览', dataIndex: 'preview', width: 80 },
  { title: '文件名', dataIndex: 'original_name', width: 260, ellipsis: true },
  { title: '分类', dataIndex: 'category', width: 90 },
  { title: '大小', dataIndex: 'size_bytes', width: 110 },
  { title: '上传人', dataIndex: 'uploaded_by_name', width: 120 },
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '操作', dataIndex: 'actions', width: 280 },
];
const typeIcons = {
  image: createIconifyIcon('lucide:image'),
  document: createIconifyIcon('lucide:file-text'),
  sheet: createIconifyIcon('lucide:sheet'),
  archive: createIconifyIcon('lucide:file-archive'),
  text: createIconifyIcon('lucide:file-code'),
  other: createIconifyIcon('lucide:file'),
};
</script>

<template>
  <Page
    title="文件管理"
    description="上传、分类和预览文件；复制链接可分享，下载可保存原文件。"
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
          分类
          <Select
            v-model:value="filters.category"
            aria-label="筛选分类"
            :options="categoryOptions"
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
      <div v-if="allowed && usage" class="mb-5" data-testid="file-usage">
        <p class="mb-1 text-sm">
          已用 {{ fileSize(usage.used_bytes) }} /
          {{ usage.quota_bytes ? fileSize(usage.quota_bytes) : '不限' }}
          <span class="text-muted-foreground">
            （{{ usage.file_count }} 个文件）
          </span>
        </p>
        <Progress
          :percent="usagePercent"
          :show-info="false"
          :stroke-color="usagePercent > 90 ? '#fa8c16' : undefined"
          aria-label="存储配额使用率"
        />
      </div>
      <Alert
        v-if="usageError"
        :message="`配额加载失败：${usageError}`"
        type="error"
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
          <template v-if="column.dataIndex === 'preview'">
            <button
              v-if="record.thumb_status === 'ready' && record.thumb_url"
              type="button"
              :aria-label="`预览 ${record.original_name}`"
              class="block h-12 w-12 overflow-hidden rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
              @click="preview(record as LibraryFile)"
            >
              <img
                :src="record.thumb_url"
                :alt="record.original_name"
                width="48"
                height="48"
                loading="lazy"
                class="h-12 w-12 object-cover"
              />
            </button>
            <Tooltip
              v-else-if="record.thumb_status === 'pending'"
              title="正在生成预览"
            >
              <span
                role="status"
                aria-label="正在生成预览"
                class="flex h-12 w-12 items-center justify-center rounded-md bg-muted"
              >
                <Spin size="small" />
              </span>
            </Tooltip>
            <span
              v-else
              role="img"
              :aria-label="`${categoryLabel(record.category)}文件`"
              class="flex h-12 w-12 items-center justify-center text-muted-foreground"
            >
              <component
                :is="
                  typeIcons[record.category as LibraryFile['category']] ??
                  typeIcons.other
                "
                class="size-6"
              />
            </span>
          </template>
          <template v-else-if="column.dataIndex === 'original_name'">
            <Tooltip :title="record.original_name">
              <span>{{ record.original_name }}</span>
            </Tooltip>
            <Tag v-if="record.id === highlighted" color="green" class="ml-2">
              新上传
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'category'">
            {{ categoryLabel(record.category) }}
          </template>
          <template v-else-if="column.dataIndex === 'size_bytes'">
            {{ fileSize(record.size_bytes) }}
          </template>
          <template v-else-if="column.dataIndex === 'uploaded_by_name'">
            {{
              record.uploaded_by_name ||
              (record.uploaded_by ? `#${record.uploaded_by}` : '未知上传人')
            }}
          </template>
          <template v-else-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(record.created_at) }}
          </template>
          <div v-else-if="column.dataIndex === 'actions'" class="flex gap-1">
            <Button
              v-if="record.category === 'image'"
              size="small"
              @click="preview(record as LibraryFile)"
            >
              预览
            </Button>
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
    <Modal
      :open="!!previewFile"
      :title="previewFile?.original_name"
      :footer="null"
      :width="900"
      @cancel="closePreview"
    >
      <p v-if="previewFile" class="mb-3 text-sm text-muted-foreground">
        {{ fileSize(previewFile.size_bytes) }} · 原图
      </p>
      <Alert
        v-if="previewError"
        :message="previewError"
        type="error"
        show-icon
      />
      <Spin :spinning="previewLoading">
        <div class="flex min-h-40 items-center justify-center">
          <img
            v-if="previewUrl"
            :src="previewUrl"
            :alt="previewFile?.original_name"
            class="max-h-[65vh] max-w-full object-contain"
            @error="previewError = '原图加载失败，请关闭后重试'"
          />
        </div>
      </Spin>
    </Modal>
  </Page>
</template>

<style scoped>
:deep(.file-new > td) {
  background: hsl(var(--accent));
}
</style>
