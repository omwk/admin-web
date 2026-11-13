<script lang="ts" setup>
import type { VbenFormSchema } from '@vben/common-ui';

import { computed } from 'vue';
import { useRoute } from 'vue-router';

import { AuthenticationLogin, z } from '@vben/common-ui';
import { $t } from '@vben/locales';

import { useAuthStore } from '#/store';

defineOptions({ name: 'Login' });
const authStore = useAuthStore();
const route = useRoute();
const invitedTenant = Number(route.query.tenant_id);
const formSchema = computed((): VbenFormSchema[] => [
  {
    component: 'VbenInput',
    componentProps: {
      type: 'number',
      min: 1,
      placeholder: '请输入租户 ID',
    },
    defaultValue:
      Number.isSafeInteger(invitedTenant) && invitedTenant > 0
        ? invitedTenant
        : 1,
    fieldName: 'tenant_id',
    label: '租户 ID',
    rules: z.coerce.number().int().min(1).max(Number.MAX_SAFE_INTEGER),
  },
  {
    component: 'VbenInput',
    componentProps: {
      autocomplete: 'username',
      placeholder: $t('authentication.usernameTip'),
    },
    fieldName: 'username',
    label: $t('authentication.username'),
    rules: z
      .string()
      .min(1, { message: $t('authentication.usernameTip') })
      .max(256),
  },
  {
    component: 'VbenInputPassword',
    componentProps: {
      autocomplete: 'current-password',
      placeholder: $t('authentication.password'),
    },
    fieldName: 'password',
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
