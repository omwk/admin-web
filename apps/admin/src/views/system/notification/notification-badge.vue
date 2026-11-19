<script setup lang="ts">
import { computed, watchEffect } from 'vue';
import { useRouter } from 'vue-router';

import { Bell } from '@vben/icons';

import { Badge, Button, Tooltip } from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';
import { useNotificationStore } from '#/store/notification';

const router = useRouter();
const notifications = useNotificationStore();
const allowed = computed(() => hasPermission('system:notify:list'));
watchEffect((onCleanup) => {
  if (!allowed.value) {
    notifications.clear();
    return;
  }
  const refresh = () => {
    void notifications.refresh();
  };
  refresh();
  const timer = window.setInterval(refresh, 60_000);
  window.addEventListener('focus', refresh);
  onCleanup(() => {
    window.clearInterval(timer);
    window.removeEventListener('focus', refresh);
  });
});
</script>

<template>
  <Tooltip v-if="allowed" :title="notifications.error || '通知中心'">
    <Badge
      :count="notifications.error ? 0 : notifications.count"
      :overflow-count="99"
      data-testid="notification-badge"
    >
      <Button
        type="text"
        :aria-label="`通知中心，${notifications.count} 条未读`"
        @click="router.push('/system/notifications')"
      >
        <Bell class="size-4" />
      </Button>
    </Badge>
  </Tooltip>
</template>
