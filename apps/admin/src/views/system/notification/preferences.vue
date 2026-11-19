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
  Table,
  Tooltip,
} from 'ant-design-vue';

import {
  getNotificationPreferencesApi,
  saveNotificationPreferencesApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import { channelLabel } from './options';
import PreferenceCell from './preference-cell.vue';
import { changedPreferences } from './preference-state';

const original = ref<NotificationPreferenceView[]>([]);
const draft = ref<NotificationPreferenceView[]>([]);
const loading = ref(false);
const saving = ref(false);
const error = ref('');
const changes = computed(() => changedPreferences(original.value, draft.value));
const templates = computed(() => [
  ...new Map(
    draft.value.map((item) => [
      item.template,
      {
        template: item.template,
        name: item.name || item.template,
        transactional: item.transactional,
      },
    ]),
  ).values(),
]);
const groups = computed(() => [
  {
    title: '安全邮件',
    rows: templates.value.filter((item) => item.transactional),
  },
  {
    title: '业务通知',
    rows: templates.value.filter((item) => !item.transactional),
  },
]);
const columns = computed(() => [
  { title: '模板', dataIndex: 'template', width: 230 },
  ...[...new Set(draft.value.map((item) => item.channel))].map((value) => ({
    title: channelLabel(value),
    dataIndex: value,
    width: 190,
  })),
]);
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
function toggle(template: string, channel: string, checked: boolean) {
  const item = preference(template, channel);
  if (
    item &&
    !item.transactional &&
    item.available !== false &&
    !item.inherited &&
    !saving.value
  )
    item.enabled = checked;
}
function customize(template: string, channel: string) {
  const item = preference(template, channel);
  if (item && !item.transactional && item.available !== false && !saving.value)
    item.inherited = false;
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
      <section v-for="group in groups" :key="group.title" class="mb-5">
        <h3 class="mb-3 font-semibold">{{ group.title }}</h3>
        <Table
          row-key="template"
          :columns="columns"
          :data-source="group.rows"
          :pagination="false"
          :scroll="{ x: 1000 }"
        >
          <template #emptyText>
            <Empty description="暂无可配置的通知模板" />
          </template>
          <template #bodyCell="{ column, record }">
            <Tooltip
              v-if="column.dataIndex === 'template'"
              :title="record.template"
            >
              <span>{{ record.name }}</span>
            </Tooltip>
            <PreferenceCell
              v-else-if="preference(record.template, String(column.dataIndex))"
              :value="preference(record.template, String(column.dataIndex))!"
              :saving="saving"
              :label="String(column.title)"
              @change="
                toggle(record.template, String(column.dataIndex), $event)
              "
              @customize="customize(record.template, String(column.dataIndex))"
            />
            <span v-else>—</span>
          </template>
        </Table>
      </section>
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
