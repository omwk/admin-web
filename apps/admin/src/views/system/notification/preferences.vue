<script setup lang="ts">
import type { NotificationPreferenceView } from '#/api/model/notification';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Empty,
  message,
  Space,
  Spin,
  Switch,
  Table,
} from 'ant-design-vue';

import {
  getNotificationPreferencesApi,
  saveNotificationPreferencesApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import { notificationChannels } from './options';
import { changedPreferences } from './preference-state';

const original = ref<NotificationPreferenceView[]>([]);
const draft = ref<NotificationPreferenceView[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const changes = computed(() => changedPreferences(original.value, draft.value));
const templates = computed(() =>
  [...new Set(draft.value.map((item) => item.template))].map((template) => ({
    template,
  })),
);
const columns = [
  { title: '模板', dataIndex: 'template', width: 230 },
  ...notificationChannels.map(({ label, value }) => ({
    title: label,
    dataIndex: value,
    width: 190,
  })),
];
function preference(template: string, channel: string) {
  return draft.value.find(
    (item) => item.template === template && item.channel === channel,
  );
}
function accept(values: NotificationPreferenceView[]) {
  original.value = values.map((item) => ({ ...item }));
  draft.value = values.map((item) => ({ ...item }));
}
async function load() {
  loading.value = true;
  error.value = '';
  try {
    const result = await getNotificationPreferencesApi();
    accept(result.preferences);
  } catch (error_) {
    error.value = notificationError(error_);
  } finally {
    loading.value = false;
  }
}
async function save() {
  if (changes.value.length === 0 || saving.value) return;
  saving.value = true;
  error.value = '';
  try {
    const result = await saveNotificationPreferencesApi(changes.value);
    accept(result.preferences);
    message.success('通知偏好已保存');
  } catch (error_) {
    error.value = notificationError(error_);
  } finally {
    saving.value = false;
  }
}
function toggle(
  template: string,
  channel: string,
  checked: boolean | number | string,
) {
  const item = preference(template, channel);
  if (item) item.enabled = Boolean(checked);
}
function customize(template: string, channel: string) {
  const item = preference(template, channel);
  if (item) item.inherited = false;
}
onMounted(load);
</script>

<template>
  <div data-testid="notification-preferences">
    <Alert
      type="info"
      message="关闭邮件等外部渠道后，站内通知仍会收到。"
      show-icon
      class="mb-4"
    />
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Spin :spinning="loading">
      <Table
        row-key="template"
        :columns="columns"
        :data-source="templates"
        :pagination="false"
        :scroll="{ x: 1180 }"
      >
        <template #emptyText>
          <Empty description="暂无可配置的通知模板" />
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex !== 'template'">
            <template
              v-if="preference(record.template, String(column.dataIndex))"
            >
              <div
                :class="{
                  'text-gray-400': preference(
                    record.template,
                    String(column.dataIndex),
                  )?.inherited,
                }"
                :data-preference="`${record.template}:${column.dataIndex}`"
              >
                <Switch
                  :checked="
                    preference(record.template, String(column.dataIndex))
                      ?.enabled
                  "
                  :disabled="
                    saving ||
                    preference(record.template, String(column.dataIndex))
                      ?.inherited
                  "
                  :aria-label="`${record.template} ${column.title}`"
                  @change="
                    (checked) =>
                      toggle(record.template, String(column.dataIndex), checked)
                  "
                />
                <div
                  v-if="
                    preference(record.template, String(column.dataIndex))
                      ?.inherited
                  "
                  class="mt-2 text-xs"
                >
                  继承租户设置
                  <Button
                    type="link"
                    size="small"
                    :disabled="saving"
                    @click="
                      customize(record.template, String(column.dataIndex))
                    "
                  >
                    自定义
                  </Button>
                </div>
                <div v-else class="mt-2 text-xs text-gray-500">个人设置</div>
              </div>
            </template>
            <span v-else>—</span>
          </template>
        </template>
      </Table>
    </Spin>
    <Space class="mt-4">
      <Button
        type="primary"
        :loading="saving"
        :disabled="loading || !changes.length"
        @click="save"
      >
        保存偏好
      </Button>
      <Button
        :disabled="loading || saving"
        @click="draft = original.map((item) => ({ ...item }))"
      >
        撤销改动
      </Button>
      <Button :disabled="loading || saving || !!changes.length" @click="load">
        刷新
      </Button>
    </Space>
  </div>
</template>
