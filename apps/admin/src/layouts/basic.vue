<script lang="ts" setup>
import { computed } from 'vue';
import { useRouter } from 'vue-router';

import { BasicLayout, LockScreen, UserDropdown } from '@vben/layouts';
import { preferences } from '@vben/preferences';
import { useUserStore } from '@vben/stores';

import { useAuthStore } from '#/store';
import NotificationBadge from '#/views/system/notification/notification-badge.vue';

const router = useRouter();
const authStore = useAuthStore();
const userStore = useUserStore();
const avatar = computed(
  () => userStore.userInfo?.avatar || preferences.app.defaultAvatar,
);
const menus = [
  {
    handler: () => router.push('/profile'),
    icon: 'lucide:user',
    text: '个人资料',
  },
  {
    handler: () => router.push('/profile/sessions'),
    icon: 'lucide:monitor',
    text: '我的会话',
  },
];
const handleLogout = () => authStore.logout(false);
</script>

<template>
  <BasicLayout
    :avatar
    :text="userStore.userInfo?.realName"
    @clear-preferences-and-logout="handleLogout"
    @logout="handleLogout"
  >
    <template #user-dropdown>
      <span
        v-if="userStore.userInfo?.tenantCode"
        data-testid="current-tenant"
        class="mr-4 max-w-48 truncate text-sm"
        :title="String(userStore.userInfo.tenantCode)"
      >
        租户：{{ userStore.userInfo.tenantCode }}
      </span>
      <NotificationBadge class="mr-4" />
      <UserDropdown
        :avatar
        :menus
        :text="userStore.userInfo?.realName"
        :description="userStore.userInfo?.username"
        @clear-preferences-and-logout="handleLogout"
        @logout="handleLogout"
      />
    </template>
    <template #lock-screen>
      <LockScreen :avatar @to-login="handleLogout" />
    </template>
  </BasicLayout>
</template>
