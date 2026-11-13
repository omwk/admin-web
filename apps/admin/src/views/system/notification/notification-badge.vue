<script setup lang="ts">
import { computed, watch } from 'vue';
import { useRouter } from 'vue-router';

import { Bell } from '@vben/icons';

import { Badge, Button, Tooltip } from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';
import { useNotificationStore } from '#/store/notification';

const router = useRouter();
const notifications = useNotificationStore();
const allowed = computed(() => hasPermission('system:notify:list'));
watch(
  allowed,
  (value) => {
    if (value) void notifications.refresh();
    else notifications.clear();
  },
  { immediate: true },
);
</script>

<template>
  <Tooltip v-if="allowed" :title="notifications.error || '通知中心'">
    <Badge
      :count="notifications.count"
      :overflow-count="99"
      show-zero
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
