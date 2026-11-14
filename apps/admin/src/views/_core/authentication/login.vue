<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { getLastTenantCode } from '#/auth/login-tenant';
import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });
const authStore = useAuthStore();
const route = useRoute();
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
    :form-schema="formSchema"
    :loading="authStore.loginLoading"
    :show-code-login="false"
    :show-forget-password="false"
    :show-qrcode-login="false"
    :show-register="false"
    :show-remember-me="false"
    :show-third-party-login="false"
    @submit="authStore.authLogin"
  />
</template>
