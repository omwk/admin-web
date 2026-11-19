<script setup lang="ts">
import type { NotificationInbox } from '#/api/model/notification';

import { computed, onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Badge,
  Button,
  Card,
  Drawer,
  Empty,
  message,
  Select,
  Space,
  Table,
  Tabs,
  Tag,
} from 'ant-design-vue';

import {
  getNotificationPreferencesApi,
  getNotificationsApi,
  readAllNotificationsApi,
  readNotificationApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';
import { hasPermission } from '#/auth/permission';
import { useNotificationStore } from '#/store/notification';
import { formatDateTime } from '#/utils/datetime';

import { notificationSummary, payloadEntries } from './options';
import Preferences from './preferences.vue';
import { useNotificationPage } from './use-notification-page';

defineOptions({ name: 'SystemNotificationList' });
const router = useRouter();
const notifications = useNotificationStore();
const unread = ref('all');
const template = ref<string>();
const templateOptions = ref<{ label: string; value: string }[]>([]);
const activeTab = ref('inbox');
const payloadLabels: Record<string, string> = {
  body: '正文',
  title: '标题',
  message: '正文',
};
const acting = ref(false);
const selected = ref<NotificationInbox>();
const actionError = ref('');
const allowed = computed(() => hasPermission('system:notify:list'));
const { rows, loading, error, pagination, load, changePage } =
  useNotificationPage((page, pageSize) =>
    getNotificationsApi({
      page,
      page_size: pageSize,
      ...(unread.value === 'unread' ? { unread: true } : {}),
      ...(template.value ? { template: template.value } : {}),
    }),
  );
const columns = [
  { title: '标题', dataIndex: 'title', width: 260 },
  { title: '摘要', dataIndex: 'summary', width: 320 },
  { title: '模板', dataIndex: 'template_name', width: 200 },
  { title: '状态', dataIndex: 'read_at', width: 100 },
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '操作', dataIndex: 'actions', width: 130 },
];
async function refresh(reset = false) {
  if (!allowed.value) return;
  await Promise.all([load(reset), notifications.refresh()]);
}
async function read(record?: NotificationInbox) {
  if (acting.value || (record && record.read_at)) return;
  acting.value = true;
  actionError.value = '';
  try {
    await (record ? readNotificationApi(record.id) : readAllNotificationsApi());
    if (record) {
      record.read_at = new Date().toISOString();
      if (selected.value?.id === record.id)
        selected.value = { ...selected.value, read_at: record.read_at };
    }
    await refresh();
    message.success(record ? '已标记为已读' : '全部通知已读');
  } catch (error_) {
    actionError.value = notificationError(error_);
  } finally {
    acting.value = false;
  }
}
async function lookups() {
  try {
    const { preferences } = await getNotificationPreferencesApi();
    templateOptions.value = [
      ...new Map(
        preferences.map((value) => [
          value.template,
          { label: value.name || value.template, value: value.template },
        ]),
      ).values(),
    ];
  } catch (error_) {
    actionError.value = notificationError(error_);
  }
}
function open(record: NotificationInbox) {
  if (acting.value) return;
  selected.value = record;
  if (!record.read_at) void read(record);
}
let mounted = false;
onMounted(() => {
  if (!allowed.value) return;
  void refresh();
  void lookups();
  mounted = true;
});
onActivated(() => {
  if (mounted) void refresh();
});
</script>

<template>
  <Page title="通知中心" description="查看站内通知，管理个人通知偏好。">
    <Alert
      v-if="!allowed"
      type="error"
      message="没有通知中心访问权限"
      show-icon
    />
    <Card v-else>
      <template #title>
        <Space>
          通知中心
          <Badge :count="notifications.error ? 0 : notifications.count" />
        </Space>
      </template>
      <template #extra>
        <Space>
          <Button
            v-if="hasPermission('system:notify:broadcast')"
            @click="router.push('/system/notifications/broadcasts')"
          >
            发布公告
          </Button>
          <Button
            v-if="hasPermission('system:notify:manage')"
            @click="router.push('/system/notifications/channels')"
          >
            通知渠道
          </Button>
        </Space>
      </template>
      <Tabs v-model:active-key="activeTab">
        <Tabs.TabPane key="inbox" tab="站内通知">
          <div class="mb-4 flex flex-wrap items-center gap-3">
            <Select
              v-model:value="unread"
              aria-label="通知状态"
              class="!w-36"
              :options="[
                { label: '全部', value: 'all' },
                { label: '未读', value: 'unread' },
              ]"
              @change="refresh(true)"
            />
            <Select
              v-model:value="template"
              aria-label="模板类型"
              placeholder="全部模板"
              allow-clear
              show-search
              option-filter-prop="label"
              class="!w-64"
              :options="templateOptions"
              @change="refresh(true)"
            />
            <Button :disabled="loading || acting" @click="refresh()">
              刷新
            </Button>
            <Button
              type="primary"
              :loading="acting"
              :disabled="loading || !notifications.count"
              @click="read()"
            >
              全部已读
            </Button>
          </div>
          <Alert
            v-if="error || actionError || notifications.error"
            :message="error || actionError || notifications.error"
            type="error"
            show-icon
            class="mb-4"
          />
          <Table
            data-testid="notification-list"
            row-key="id"
            :columns="columns"
            :data-source="rows"
            :loading="loading"
            :pagination="pagination"
            :row-class-name="
              (record: NotificationInbox) =>
                record.read_at ? '' : 'font-semibold'
            "
            :custom-row="
              (record: NotificationInbox) => ({
                class: 'cursor-pointer',
                'data-notification-id': record.id,
                onClick: () => open(record),
              })
            "
            :scroll="{ x: 1200 }"
            @change="changePage"
          >
            <template #emptyText><Empty description="暂无通知" /></template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'title'">
                <span
                  v-if="!record.read_at"
                  class="mr-2 inline-block size-2 rounded-full bg-blue-500"
                  aria-label="未读"
                ></span>
                {{ record.title || record.template_name || '通知' }}
              </template>
              <template v-else-if="column.dataIndex === 'read_at'">
                <Tag :color="record.read_at ? 'default' : 'blue'">
                  {{ record.read_at ? '已读' : '● 未读' }}
                </Tag>
              </template>
              <template v-else-if="column.dataIndex === 'created_at'">
                {{ formatDateTime(record.created_at) }}
              </template>
              <template v-else-if="column.dataIndex === 'summary'">
                <p class="line-clamp-2 whitespace-normal break-words">
                  {{ record.summary || notificationSummary(record.payload) }}
                </p>
              </template>
              <template v-else-if="column.dataIndex === 'actions'">
                <Button
                  type="link"
                  :disabled="!!record.read_at || acting"
                  @click.stop="read(record as NotificationInbox)"
                >
                  标为已读
                </Button>
              </template>
            </template>
          </Table>
        </Tabs.TabPane>
        <Tabs.TabPane key="preferences" tab="通知偏好">
          <Preferences v-if="activeTab === 'preferences'" />
        </Tabs.TabPane>
      </Tabs>
    </Card>
    <Drawer
      :open="!!selected"
      :title="selected?.title || '通知详情'"
      :width="640"
      @close="selected = undefined"
    >
      <div v-if="selected" data-testid="notification-detail">
        <p class="mb-4 text-gray-500">
          {{ selected.template_name }} ·
          {{ formatDateTime(selected.created_at) }} ·
          {{ selected.read_at ? '已读' : '未读' }}
        </p>
        <dl class="grid grid-cols-[100px_1fr] gap-3">
          <template
            v-for="entry in payloadEntries(selected.payload)"
            :key="entry.key"
          >
            <dt class="text-gray-500">
              {{ payloadLabels[entry.key] || entry.key }}
            </dt>
            <dd class="whitespace-pre-wrap break-words">{{ entry.value }}</dd>
          </template>
        </dl>
        <Empty
          v-if="!Object.keys(selected.payload).length"
          description="暂无详情"
        />
      </div>
    </Drawer>
  </Page>
</template>
