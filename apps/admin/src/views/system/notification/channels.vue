<script setup lang="ts">
import { ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Card, Tabs } from 'ant-design-vue';

import { hasPermission } from '#/auth/permission';

import Deliveries from './deliveries.vue';
import Providers from './providers.vue';
import Templates from './templates.vue';

defineOptions({ name: 'SystemNotificationChannels' });
const activeTab = ref('providers');
const deliveryVersion = ref(0);
</script>

<template>
  <Page title="通知渠道" description="配置服务商、消息模板并查看投递结果。">
    <Alert
      v-if="!hasPermission('system:notify:manage')"
      message="没有通知渠道管理权限"
      type="error"
      show-icon
    />
    <Card v-else>
      <Tabs v-model:active-key="activeTab">
        <Tabs.TabPane key="providers" tab="服务商">
          <Providers
            v-if="activeTab === 'providers'"
            @delivery-changed="deliveryVersion++"
          />
        </Tabs.TabPane>
        <Tabs.TabPane key="templates" tab="模板">
          <Templates v-if="activeTab === 'templates'" />
        </Tabs.TabPane>
        <Tabs.TabPane key="deliveries" tab="投递记录">
          <Deliveries
            v-if="activeTab === 'deliveries'"
            :key="deliveryVersion"
          />
        </Tabs.TabPane>
      </Tabs>
    </Card>
  </Page>
</template>
