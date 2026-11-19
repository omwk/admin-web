<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Checkbox,
  Empty,
  Form,
  Input,
  Radio,
  Select,
  Table,
  Tabs,
} from 'ant-design-vue';

import { getNotificationBroadcastsApi } from '#/api/core/notifications';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { channelLabel } from './options';
import { useBroadcastForm } from './use-broadcast-form';
import { useNotificationPage } from './use-notification-page';

defineOptions({ name: 'SystemNotificationBroadcasts' });
const allowed = hasPermission('system:notify:broadcast');
const tab = ref('publish');
const history = useNotificationPage(getNotificationBroadcastsApi);
const {
  form,
  roleIds,
  userIds,
  roles,
  users,
  lookupError,
  loadingRoles,
  loadingUsers,
  error,
  previewing,
  locked,
  recipients,
  searchUsers,
  preview,
  publish,
} = useBroadcastForm(async () => {
  tab.value = 'history';
  await history.load(true);
});
const audienceLabels: Record<string, string> = {
  all: '全部用户',
  roles: '指定角色',
  users: '指定用户',
};
function audienceText(audience: { type: string; ids?: number[] }) {
  const label = audienceLabels[audience.type] || audience.type;
  return audience.ids?.length ? `${label}（${audience.ids.length} 项）` : label;
}
const columns = [
  { title: '标题', dataIndex: 'title' },
  { title: '时间', dataIndex: 'created_at', width: 190 },
  { title: '范围', dataIndex: 'audience', width: 180 },
  { title: '渠道', dataIndex: 'channels', width: 160 },
  { title: '人数', dataIndex: 'recipients', width: 100 },
];
onMounted(() => {
  if (allowed) void history.load();
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="公告发布"
    description="选择目标范围与渠道，预览人数并确认发布。"
  >
    <Card data-testid="notification-broadcasts">
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <Tabs v-model:active-key="tab">
        <Tabs.TabPane key="publish" tab="发布公告">
          <Form layout="vertical" class="max-w-3xl" :disabled="locked">
            <Form.Item label="标题" required>
              <Input
                v-model:value="form.title"
                aria-label="公告标题"
                :maxlength="128"
                show-count
              />
            </Form.Item>
            <Form.Item label="正文" required>
              <Input.TextArea
                v-model:value="form.body"
                aria-label="公告正文"
                :rows="7"
                :maxlength="2000"
                show-count
              />
            </Form.Item>
            <Form.Item label="范围" required>
              <Radio.Group
                v-model:value="form.audience.type"
                aria-label="公告范围"
                :options="[
                  { label: '全部用户', value: 'all' },
                  { label: '指定角色', value: 'roles' },
                  { label: '指定用户', value: 'users' },
                ]"
              />
              <Select
                v-if="form.audience.type === 'roles'"
                v-model:value="roleIds"
                mode="multiple"
                show-search
                aria-label="公告角色"
                placeholder="选择角色"
                class="mt-3 w-full"
                :loading="loadingRoles"
                :options="roles"
                option-filter-prop="label"
              />
              <Select
                v-if="form.audience.type === 'users'"
                v-model:value="userIds"
                mode="multiple"
                show-search
                aria-label="公告用户"
                placeholder="搜索用户名或昵称"
                class="mt-3 w-full"
                :loading="loadingUsers"
                :options="users"
                :filter-option="false"
                @search="searchUsers"
              />
              <Alert
                v-if="lookupError"
                :message="lookupError"
                type="error"
                show-icon
                class="mt-3"
              />
            </Form.Item>
            <Form.Item label="渠道" required>
              <Checkbox.Group
                v-model:value="form.channels"
                :options="[
                  { label: '站内信', value: 'inbox' },
                  { label: '邮件', value: 'email' },
                ]"
                aria-label="公告渠道"
              />
            </Form.Item>
            <p
              v-if="recipients !== undefined"
              class="mb-4 font-semibold"
              data-testid="broadcast-recipients"
            >
              将发送给 {{ recipients }} 人
            </p>
            <div class="flex gap-3">
              <Button :loading="previewing" :disabled="locked" @click="preview">
                预览人数
              </Button>
              <Button
                type="primary"
                :disabled="
                  locked ||
                  previewing ||
                  recipients === undefined ||
                  recipients === 0
                "
                @click="publish"
              >
                发布
              </Button>
            </div>
          </Form>
        </Tabs.TabPane>
        <Tabs.TabPane key="history" tab="发布历史">
          <Button
            class="mb-4"
            :disabled="history.loading.value"
            @click="history.load()"
          >
            刷新历史
          </Button>
          <Alert
            v-if="history.error.value"
            :message="history.error.value"
            type="error"
            show-icon
            class="mb-4"
          />
          <Table
            data-testid="broadcast-history"
            row-key="broadcast_id"
            :columns="columns"
            :data-source="history.rows.value"
            :loading="history.loading.value"
            :pagination="history.pagination.value"
            :scroll="{ x: 900 }"
            @change="history.changePage"
          >
            <template #emptyText><Empty description="暂无公告历史" /></template>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'created_at'">
                {{ formatDateTime(record.created_at) }}
              </template>
              <template v-else-if="column.dataIndex === 'channels'">
                {{ record.channels.map(channelLabel).join('、') }}
              </template>
              <template v-else-if="column.dataIndex === 'audience'">
                {{ audienceText(record.audience) }}
              </template>
            </template>
          </Table>
        </Tabs.TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
