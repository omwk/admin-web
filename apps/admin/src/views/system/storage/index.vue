<script setup lang="ts">
import type { StorageProvider } from '#/api/model/storage';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  defaultStorageProviderApi,
  deleteStorageProviderApi,
  getStorageProvidersApi,
  testStorageProviderApi,
} from '#/api/core/storage';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';
import { platformTenantId } from '#/auth/tenant';
import NotFound from '#/views/_core/fallback/not-found.vue';

import { connectionResult, providerAddress } from './options';
import ProviderForm from './provider-form.vue';

defineOptions({ name: 'SystemStorage' });
const allowed = computed(
  () =>
    useUserStore().userInfo?.tenantId === platformTenantId &&
    hasPermission('system:storage:manage'),
);
const rows = ref<StorageProvider[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const result = ref<ReturnType<typeof connectionResult>>();
const open = ref(false);
const editing = ref<StorageProvider>();
let sequence = 0;
async function load() {
  if (!allowed.value) return;
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const data = await getStorageProvidersApi();
    if (current === sequence) rows.value = data;
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
onMounted(load);
onUnmounted(() => {
  sequence++;
  rows.value = [];
  editing.value = undefined;
});
function edit(provider?: StorageProvider) {
  editing.value = provider;
  open.value = true;
}
function close() {
  open.value = false;
  editing.value = undefined;
}
async function action(
  provider: StorageProvider,
  kind: 'default' | 'delete' | 'test',
) {
  if (
    busy.value ||
    !allowed.value ||
    (kind === 'delete' && provider.is_default)
  )
    return;
  busy.value = true;
  error.value = '';
  result.value = undefined;
  try {
    if (kind === 'test') {
      const tested = await testStorageProviderApi(provider.id);
      result.value = connectionResult(tested.status);
    } else {
      await (kind === 'default'
        ? defaultStorageProviderApi(provider.id)
        : deleteStorageProviderApi(provider.id));
      message.success(kind === 'default' ? '已设为默认，立即生效' : '已删除');
      await load();
    }
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
function remove(provider: StorageProvider) {
  if (provider.is_default || busy.value) return;
  Modal.confirm({
    title: '删除存储配置？',
    content: `确定删除「${provider.name}」？`,
    okText: '删除',
    okType: 'danger',
    cancelText: '取消',
    onOk: () => action(provider, 'delete'),
  });
}
const columns = [
  { title: '名称', dataIndex: 'name', width: 180 },
  { title: '地址', dataIndex: 'address', width: 260 },
  { title: '桶', dataIndex: 'bucket', width: 140 },
  { title: '默认', dataIndex: 'is_default', width: 90 },
  { title: '状态', dataIndex: 'enabled', width: 90 },
  { title: '操作', dataIndex: 'actions', width: 300 },
];
</script>

<template>
  <NotFound v-if="!allowed" />
  <Page
    v-else
    title="存储配置"
    description="管理对象存储服务，配置保存后立即生效。"
  >
    <Card data-testid="storage-page">
      <div class="mb-4 flex items-center justify-between">
        <Button type="primary" :disabled="busy || loading" @click="edit()">
          新建配置
        </Button>
        <Button :disabled="busy" @click="load">刷新</Button>
      </div>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="load">重试</Button>
        </template>
      </Alert>
      <Alert
        v-if="result"
        :message="result.text"
        :type="result.type"
        show-icon
        class="mb-4"
      />
      <Table
        row-key="id"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1060 }"
      >
        <template #emptyText>
          <Empty v-if="!loading && !error" description="还没有对象存储配置">
            <p class="mb-3 text-muted-foreground">未配置时上传功能不可用。</p>
            <Button type="primary" @click="edit()">新建配置</Button>
          </Empty>
          <span v-else>{{ error ? '配置加载失败，请重试' : '正在加载' }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'address'">
            {{ providerAddress(record as StorageProvider) }}
          </template>
          <template v-else-if="column.dataIndex === 'is_default'">
            <Tag v-if="record.is_default" color="blue">默认</Tag>
            <span v-else>—</span>
          </template>
          <template v-else-if="column.dataIndex === 'enabled'">
            <Tag :color="record.enabled ? 'green' : 'default'">
              {{ record.enabled ? '启用' : '停用' }}
            </Tag>
          </template>
          <div
            v-else-if="column.dataIndex === 'actions'"
            class="flex flex-wrap gap-1"
          >
            <Button
              size="small"
              :disabled="busy || loading"
              @click="action(record as StorageProvider, 'test')"
            >
              测试
            </Button>
            <Button
              size="small"
              :disabled="
                busy || loading || record.is_default || !record.enabled
              "
              @click="action(record as StorageProvider, 'default')"
            >
              设为默认
            </Button>
            <Button
              size="small"
              :disabled="busy || loading"
              @click="edit(record as StorageProvider)"
            >
              编辑
            </Button>
            <Tooltip :title="record.is_default ? '请先切换默认配置' : ''">
              <span>
                <Button
                  size="small"
                  danger
                  :disabled="busy || loading || record.is_default"
                  @click="remove(record as StorageProvider)"
                >
                  删除
                </Button>
              </span>
            </Tooltip>
          </div>
        </template>
      </Table>
    </Card>
    <ProviderForm
      :open="open"
      :provider="editing"
      @close="close"
      @saved="load"
    />
  </Page>
</template>
