<script lang="ts" setup>
import { useRouter } from 'vue-router';

import { Fallback } from '@vben/common-ui';

import { Button, Space } from 'ant-design-vue';

defineOptions({ name: 'NotFound' });
const router = useRouter();
function back() {
  if (window.history.state?.back || window.history.length > 1) router.back();
  else void router.replace('/home');
}
</script>

<template>
  <Fallback status="404" title="404 · 页面不存在">
    <template #action>
      <Space>
        <Button type="primary" @click="router.push('/home')">返回首页</Button>
        <Button @click="back">返回上一页</Button>
      </Space>
    </template>
  </Fallback>
</template>
