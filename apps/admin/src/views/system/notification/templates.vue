<script setup lang="ts">
import type { NotificationTemplate } from '#/api/model/notification';

import { onMounted, ref } from 'vue';

import { Alert, Button, Empty, message, Table, Tag } from 'ant-design-vue';

import { getNotificationTemplatesApi } from '#/api/core/notifications';

import TemplateForm from './template-form.vue';
import { useNotificationPage } from './use-notification-page';

const { rows, loading, error, pagination, load, changePage } =
  useNotificationPage(getNotificationTemplatesApi);
const editing = ref<NotificationTemplate>();
const columns = [
  { title: '模板编码', dataIndex: 'code', width: 240 },
  { title: '语言', dataIndex: 'locale', width: 110 },
  { title: '主题', dataIndex: 'subject' },
  { title: '范围', dataIndex: 'tenant_id', width: 110 },
  { title: '启用', dataIndex: 'enabled', width: 100 },
  { title: '操作', dataIndex: 'actions', width: 90 },
];
async function saved() {
  editing.value = undefined;
  await load();
  message.success('通知模板已保存');
}
onMounted(() => load());
</script>

<template>
  <div data-testid="notification-templates">
    <Button :disabled="loading" class="mb-4" @click="load()">刷新</Button>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 800 }"
      @change="changePage"
    >
      <template #emptyText><Empty description="暂无通知模板" /></template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'tenant_id'">
          {{ record.tenant_id === null ? '全局' : '租户覆盖' }}
        </template>
        <template v-else-if="column.dataIndex === 'enabled'">
          <Tag :color="record.enabled ? 'success' : 'default'">
            {{ record.enabled ? '启用' : '停用' }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Button type="link" @click="editing = record as NotificationTemplate">
            编辑
          </Button>
        </template>
      </template>
    </Table>
    <TemplateForm
      v-if="editing"
      :template="editing"
      @close="editing = undefined"
      @saved="saved"
    />
  </div>
</template>
