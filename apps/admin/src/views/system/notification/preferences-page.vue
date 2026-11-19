<script setup lang="ts">
import { Page } from '@vben/common-ui';

import { Card } from 'ant-design-vue';

import Preferences from './preferences.vue';

defineOptions({ name: 'NotificationPreferences' });
</script>

<template>
  <Page title="通知偏好" description="按通知方式设置个人偏好。">
    <Card><Preferences /></Card>
  </Page>
</template>
