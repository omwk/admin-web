<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getLastTenantCode } from '#/auth/login-tenant';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });
const authStore = useAuthStore();
const route = useRoute();
const router = useRouter();
const login = ref<InstanceType<typeof AuthenticationLogin>>();
async function goRegister() {
  const values = await login.value?.getFormApi().getValues();
  const tenant = typeof values?.tenant === 'string' ? values.tenant.trim() : '';
  await router.push({ name: 'Register', query: tenant ? { tenant } : {} });
}
const invitedTenant =
  typeof route.query.tenant === 'string' ? route.query.tenant.trim() : '';
const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      autocomplete: 'organization',
      'aria-label': '企业代码',
      maxlength: 64,
      placeholder: '请输入企业代码',
    },
    defaultValue: invitedTenant || getLastTenantCode(),
    fieldName: 'tenant',
    hideLabel: false,
    label: '企业代码',
    rules: z.string().trim().min(1, { message: '请输入企业代码' }).max(64),
  },
  {
    component: 'VbenInput',
    componentProps: {
      autocomplete: 'username',
      'aria-label': '账号',
      placeholder: '请输入用户名、邮箱或手机',
    },
    fieldName: 'account',
    hideLabel: false,
    label: '账号',
    rules: z.string().trim().min(1, { message: '请输入账号' }).max(256),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      autocomplete: 'current-password',
      'aria-label': '密码',
      placeholder: $t('authentication.password'),
    },
    fieldName: 'password',
    hideLabel: false,
    label: $t('authentication.password'),
    rules: z
      .string()
      .min(1, { message: $t('authentication.passwordTip') })
      .max(1024),
  },
]);
</script>

<template>
  <AuthenticationLogin
    ref="login"
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    @submit="authStore.authLogin"
  >
    <template #to-register>
      <p class="mt-4 text-center text-sm text-muted-foreground">
        <span>还没有账号？联系管理员邀请，或</span>
        <a
          :href="router.resolve({ name: 'Register' }).href"
          class="vben-link"
          @click.prevent="goRegister"
        >
          在此注册
        </a>
      </p>
    </template>
  </AuthenticationLogin>
</template>
