<script setup lang="ts">
import type { NotificationInbox } from '#/api/model/notification';

import { computed, onUnmounted, ref, watch } from 'vue';
import { RouterLink } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useAccessStore, useUserStore } from '@vben/stores';

import { Alert, Button, Card, Empty, List, Spin } from 'ant-design-vue';

import { getNotificationsApi } from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import { notificationSummary } from '#/views/system/notification/options';

import { homeShortcuts } from './shortcuts';

defineOptions({ name: 'Home' });
const access = useAccessStore();
const user = useUserStore();
const shortcuts = computed(() => homeShortcuts(access.accessMenus));
const canReadNotifications = computed(() =>
  hasPermission('system:notify:list'),
);
const today = new Intl.DateTimeFormat('zh-CN', { dateStyle: 'full' }).format(
  new Date(),
);
const notices = ref<NotificationInbox[]>([]);
const loading = ref(false);
const error = ref('');
let sequence = 0;
async function load() {
  const current = ++sequence;
  notices.value = [];
  error.value = '';
  if (!canReadNotifications.value) {
    loading.value = false;
    return;
  }
  loading.value = true;
  try {
    const data = await getNotificationsApi({ page: 1, page_size: 3 });
    if (current === sequence) notices.value = (data.list ?? []).slice(0, 3);
  } catch (error_) {
    if (current === sequence) error.value = notificationError(error_);
  } finally {
    if (current === sequence) loading.value = false;
  }
}
watch(canReadNotifications, load, { immediate: true });
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page title="首页">
    <Card class="mb-4" data-testid="home-welcome">
      <h1 class="mb-3 text-2xl font-semibold">
        欢迎回来，{{ user.userInfo?.realName || user.userInfo?.username }}
      </h1>
      <p class="text-muted-foreground">
        当前租户：{{
          user.userInfo?.tenantCode || `租户 #${user.userInfo?.tenantId}`
        }}
        <span class="mx-3">·</span>{{ today }}
      </p>
    </Card>
    <Card title="快捷入口" class="mb-4">
      <div
        v-if="shortcuts.length"
        class="grid gap-3 sm:grid-cols-2 xl:grid-cols-3"
        data-testid="home-shortcuts"
      >
        <RouterLink
          v-for="entry in shortcuts"
          :key="entry.path"
          :to="{ path: entry.path, query: entry.query }"
        >
          <Button block size="large">{{ entry.name }}</Button>
        </RouterLink>
      </div>
      <Empty v-else description="你还没有被分配权限，请联系管理员" />
    </Card>
    <Card
      v-if="canReadNotifications"
      title="最近通知"
      data-testid="home-notifications"
    >
      <template #extra>
        <RouterLink to="/system/notifications">查看全部</RouterLink>
      </template>
      <Alert v-if="error" :message="error" type="error" show-icon>
        <template #action>
          <Button size="small" @click="load">重试</Button>
        </template>
      </Alert>
      <Spin v-else :spinning="loading">
        <List :data-source="notices" :locale="{ emptyText: '暂无通知' }">
          <template #renderItem="{ item }">
            <List.Item>
              <List.Item.Meta
                :title="notificationSummary(item.payload) || item.template"
                :description="formatDateTime(item.created_at)"
              />
            </List.Item>
          </template>
        </List>
      </Spin>
    </Card>
  </Page>
</template>
