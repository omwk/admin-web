<script setup lang="ts">
import { onMounted, onUnmounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Button, Result, Spin } from 'ant-design-vue';

import { verifyMyEmailApi } from '#/api/core/self-service';
import { rememberTenantCode } from '#/auth/login-tenant';
import { useAuthStore } from '#/store';

defineOptions({ name: 'EmailVerify' });
const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const state = ref<'failure' | 'loading' | 'success'>('loading');
const email = ref('');
let disposed = false;
let timer: ReturnType<typeof setTimeout> | undefined;
async function login() {
  if (timer) clearTimeout(timer);
  const tenant =
    typeof route.query.tenant === 'string' ? route.query.tenant : '';
  if (tenant) rememberTenantCode(tenant);
  await authStore.expireSession(false);
  await router.replace({ name: 'Login', query: tenant ? { tenant } : {} });
}
onUnmounted(() => {
  disposed = true;
  if (timer) clearTimeout(timer);
});
onMounted(async () => {
  const token =
    new URLSearchParams(route.hash.replace(/^#/, '')).get('token') || '';
  const query = { ...route.query };
  delete query.token;
  // The auth layout keys views by fullPath; scrub without remounting this view.
  router.options.history.replace(
    router.resolve({ path: route.path, query, hash: '' }).fullPath,
  );
  if (disposed) return;
  if (!token || token.length > 128) {
    state.value = 'failure';
    return;
  }
  try {
    const result = await verifyMyEmailApi(token);
    if (disposed) return;
    email.value = result.email;
    state.value = 'success';
    timer = setTimeout(() => void login(), 3000);
  } catch {
    if (!disposed) state.value = 'failure';
  }
});
</script>

<template>
  <div v-if="state === 'loading'" role="status" class="py-12 text-center">
    <Spin />
    <p class="mt-4">正在验证新邮箱…</p>
  </div>
  <Result v-else-if="state === 'success'" status="success" title="邮箱变更成功">
    <template #subTitle>
      <p class="break-all">{{ email }}</p>
      <p>3 秒后前往登录，请使用新邮箱登录。</p>
    </template>
    <template #extra>
      <Button type="primary" @click="login">前往登录</Button>
    </template>
  </Result>
  <Result v-else status="error" title="链接已失效，请重新获取验证邮件">
    <template #extra>
      <Button @click="router.push('/profile')">返回个人资料重新发送</Button>
    </template>
  </Result>
</template>
