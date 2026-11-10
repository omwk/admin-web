<script lang="ts" setup>
import { Page } from '@vben/common-ui';

import { Result } from 'ant-design-vue';
</script>

<template>
  <Page auto-content-height>
    <Result
      status="403"
      title="暂无可用菜单"
      sub-title="请联系管理员分配菜单权限。"
    />
  </Page>
</template>
