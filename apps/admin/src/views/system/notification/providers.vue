<script setup lang="ts">
import type { NotificationProvider } from '#/api/model/notification';

import { onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Empty,
  message,
  Modal,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteNotificationProviderApi,
  getNotificationProvidersApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import { channelLabel } from './options';
import { providerKinds } from './provider-fields';
import ProviderForm from './provider-form.vue';
import ProviderTest from './provider-test.vue';
import { useNotificationPage } from './use-notification-page';

const emit = defineEmits<{ deliveryChanged: [] }>();
const { rows, loading, error, pagination, load, changePage } =
  useNotificationPage(getNotificationProvidersApi);
const formOpen = ref(false);
const editing = ref<NotificationProvider>();
const testing = ref<NotificationProvider>();
const actionError = ref('');
const deleting = ref(false);
const columns = [
  { title: '名称', dataIndex: 'name' },
  { title: '类型 / 渠道', dataIndex: 'kind' },
  { title: '配置', dataIndex: 'config' },
  { title: '启用', dataIndex: 'enabled' },
  { title: '优先级', dataIndex: 'priority' },
  { title: '操作', dataIndex: 'actions', width: 250 },
];
function edit(provider?: NotificationProvider) {
  editing.value = provider;
  formOpen.value = true;
}
async function saved() {
  formOpen.value = false;
  await load();
  message.success('服务商已保存');
}
function remove(provider: NotificationProvider) {
  Modal.confirm({
    title: `删除服务商「${provider.name}」？`,
    content: '已有投递记录的服务商需停用，无法删除。',
    okType: 'danger',
    async onOk() {
      deleting.value = true;
      actionError.value = '';
      try {
        await deleteNotificationProviderApi(provider.id);
        await load();
        message.success('服务商已删除');
      } catch (error_) {
        actionError.value = notificationError(error_);
      } finally {
        deleting.value = false;
      }
    },
  });
}
onMounted(() => load());
</script>

<template>
  <div data-testid="notification-providers">
    <Space class="mb-4">
      <Button type="primary" @click="edit()">新增服务商</Button>

      <Button :disabled="loading || deleting" @click="load()"> 刷新 </Button>
    </Space>
    <Alert
      v-if="error || actionError"
      :message="error || actionError"
      type="error"
      show-icon
      class="mb-4"
    />
    <Table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="pagination"
      :scroll="{ x: 900 }"
      :custom-row="
        (record: NotificationProvider) => ({
          class: '',
          'data-provider-id': record.id,
        })
      "
      @change="changePage"
    >
      <template #emptyText>
        <Empty description="尚未配置通知渠道，配置后才能发送邮件" />
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'kind'">
          {{
            providerKinds.find((value) => value.value === record.kind)?.label ??
            record.kind
          }}
          / {{ channelLabel(record.channel) }}
        </template>
        <template v-else-if="column.dataIndex === 'config'">
          <Tag>
            {{
              Object.values(record.config).some(Boolean) ? '已配置' : '未配置'
            }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'enabled'">
          <Tag :color="record.enabled ? 'success' : 'default'">
            {{ record.enabled ? '启用' : '停用' }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'actions'">
          <Space>
            <Button
              type="link"
              :disabled="deleting"
              @click="edit(record as NotificationProvider)"
            >
              编辑
            </Button>

            <Button
              type="link"
              :disabled="deleting"
              @click="testing = record as NotificationProvider"
            >
              测试发送
            </Button>

            <Button
              danger
              type="link"
              :disabled="deleting"
              @click="remove(record as NotificationProvider)"
            >
              删除
            </Button>
          </Space>
        </template>
      </template>
    </Table>
    <ProviderForm
      v-if="formOpen"
      :provider="editing"
      @close="formOpen = false"
      @saved="saved"
    />
    <ProviderTest
      v-if="testing"
      :provider="testing"
      @close="testing = undefined"
      @updated="emit('deliveryChanged')"
    />
  </div>
</template>
