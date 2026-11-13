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
const acting = ref(false);
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
  { title: '状态', dataIndex: 'read_at', width: 100 },
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '类型', dataIndex: 'template', width: 240 },
  { title: '摘要', dataIndex: 'summary', ellipsis: true },
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
      ...new Set(preferences.map((value) => value.template)),
    ].map((value) => ({ label: value, value }));
  } catch (error_) {
    actionError.value = notificationError(error_);
  }
}
function expand(expanded: boolean, record: NotificationInbox) {
  if (expanded && !record.read_at) void read(record);
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
        <Space>通知中心 <Badge :count="notifications.count" show-zero /></Space>
      </template>
      <template #extra>
        <Button
          v-if="hasPermission('system:notify:manage')"
          @click="router.push('/system/notifications/channels')"
        >
          通知渠道
        </Button>
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
                class: '',
                'data-notification-id': record.id,
              })
            "
            :scroll="{ x: 850 }"
            expand-row-by-click
            @change="changePage"
            @expand="expand"
          >
            <template #emptyText><Empty description="暂无通知" /></template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'read_at'">
                <Tag :color="record.read_at ? 'default' : 'blue'">
                  {{ record.read_at ? '已读' : '● 未读' }}
                </Tag>
              </template>
              <template v-else-if="column.dataIndex === 'created_at'">
                {{ formatDateTime(record.created_at) }}
              </template>
              <template v-else-if="column.dataIndex === 'summary'">
                {{ notificationSummary(record.payload) }}
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
            <template #expandedRowRender="{ record }">
              <dl
                class="grid grid-cols-[minmax(80px,180px)_1fr] gap-3 p-3"
                data-testid="notification-detail"
              >
                <template
                  v-for="entry in payloadEntries(record.payload)"
                  :key="entry.key"
                >
                  <dt class="text-gray-500">{{ entry.key }}</dt>
                  <dd class="whitespace-pre-wrap break-all">
                    {{ entry.value }}
                  </dd>
                </template>
              </dl>
              <Empty
                v-if="!Object.keys(record.payload).length"
                description="暂无详情"
              />
            </template>
          </Table>
        </Tabs.TabPane>
        <Tabs.TabPane key="preferences" tab="通知偏好">
          <Preferences v-if="activeTab === 'preferences'" />
        </Tabs.TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
