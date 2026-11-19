<script setup lang="ts">
import { Page } from '@vben/common-ui';

import NotificationSetting from './notification-setting.vue';

defineOptions({ name: 'PersonalNotifications' });
</script>

<template>
  <Page
    title="通知方式"
    description="管理个人通知的接收地址，保存后测试成功才会验证。"
  >
    <NotificationSetting />
  </Page>
</template>
