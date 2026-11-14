<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { Button, Result, Spin } from 'ant-design-vue';

import { verifyRegistrationApi } from '#/api/core/registration';

defineOptions({ name: 'RegisterVerify' });
const route = useRoute();
const state = ref<'failure' | 'loading' | 'success'>('loading');
let disposed = false;
onUnmounted(() => {
  disposed = true;
});
onMounted(async () => {
  const token =
    typeof route.query.token === 'string'
      ? route.query.token
      : (new URLSearchParams(route.hash.replace(/^#/, '')).get('token') ?? '');
  if (!token || token.length > 128) {
    state.value = 'failure';
    return;
  }
  try {
    await verifyRegistrationApi(token);
    if (!disposed) state.value = 'success';
  } catch {
    if (!disposed) state.value = 'failure';
  }
});
</script>

<template>
  <div v-if="state === 'loading'" role="status" class="py-12 text-center">
    <Spin />
    <p class="mt-4">正在验证邮箱…</p>
  </div>
  <Result
    v-else-if="state === 'success'"
    status="success"
    title="邮箱已验证，现在可以登录了"
  >
    <template #extra>
      <RouterLink v-slot="{ href, navigate }" :to="{ name: 'Login' }" custom>
        <Button type="primary" :href="href" @click="navigate">登录</Button>
      </RouterLink>
    </template>
  </Result>
  <Result v-else status="error" title="链接无效或已过期">
    <template #extra>
      <RouterLink :to="{ name: 'Register' }" class="vben-link">
        重新注册
      </RouterLink>
    </template>
  </Result>
</template>
