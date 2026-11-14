<script setup lang="ts">
import { computed, onUnmounted, reactive, ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

import { Alert, Button, Form, Input, Result } from 'ant-design-vue';

import { registerApi } from '#/api/core/registration';
import {
  REGISTRATION_ACCEPTED_MESSAGE,
  registrationErrors,
  registrationFailureMessage,
} from '#/auth/registration';

defineOptions({ name: 'Register' });
const route = useRoute();
const queryTenant = computed(() =>
  typeof route.query.tenant === 'string' ? route.query.tenant.trim() : '',
);
const draft = reactive({
  tenant: queryTenant.value,
  account: '',
  email: '',
  password: '',
  confirmation: '',
});
const busy = ref(false);
const accepted = ref(false);
const error = ref('');
const errors = ref<Record<string, string>>({});
let disposed = false;
watch(queryTenant, (value) => {
  draft.tenant = value;
});
onUnmounted(() => {
  disposed = true;
});

async function submit() {
  if (busy.value || accepted.value) return;
  error.value = '';
  errors.value = registrationErrors(draft);
  if (Object.keys(errors.value).length > 0) return;
  busy.value = true;
  try {
    await registerApi({
      tenant: draft.tenant.trim(),
      account: draft.account.trim(),
      email: draft.email.trim(),
      password: draft.password,
    });
    if (!disposed) {
      accepted.value = true;
      draft.password = '';
      draft.confirmation = '';
    }
  } catch (error_) {
    if (!disposed) error.value = registrationFailureMessage(error_);
  } finally {
    if (!disposed) busy.value = false;
  }
}
</script>

<template>
  <Result
    v-if="accepted"
    status="success"
    :title="REGISTRATION_ACCEPTED_MESSAGE"
  >
    <template #extra>
      <RouterLink
        class="vben-link"
        :to="{ name: 'Login', query: { tenant: draft.tenant.trim() } }"
      >
        返回登录
      </RouterLink>
    </template>
  </Result>
  <div v-else>
    <h1 class="mb-2 text-2xl font-bold">注册账号</h1>
    <p class="mb-6 text-muted-foreground">注册后请完成邮箱验证。</p>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="draft" layout="vertical" :disabled="busy" @finish="submit">
      <Form.Item
        label="企业代码"
        :validate-status="errors.tenant ? 'error' : undefined"
        :help="errors.tenant"
      >
        <Input
          v-model:value="draft.tenant"
          aria-label="企业代码"
          autocomplete="organization"
          :readonly="Boolean(queryTenant)"
          :maxlength="64"
          placeholder="请输入企业代码"
        />
      </Form.Item>
      <Form.Item
        label="账号"
        :validate-status="errors.account ? 'error' : undefined"
        :help="errors.account"
      >
        <Input
          v-model:value="draft.account"
          aria-label="账号"
          autocomplete="username"
          :maxlength="256"
          placeholder="请输入账号"
        />
      </Form.Item>
      <Form.Item
        label="邮箱"
        :validate-status="errors.email ? 'error' : undefined"
        :help="errors.email"
      >
        <Input
          v-model:value="draft.email"
          aria-label="邮箱"
          autocomplete="email"
          :maxlength="256"
          placeholder="请输入邮箱"
        />
      </Form.Item>
      <Form.Item
        label="密码"
        :validate-status="errors.password ? 'error' : undefined"
        :help="errors.password"
      >
        <Input.Password
          v-model:value="draft.password"
          aria-label="密码"
          autocomplete="new-password"
          placeholder="至少 8 个字符，含字母和数字"
        />
      </Form.Item>
      <Form.Item
        label="确认密码"
        :validate-status="errors.confirmation ? 'error' : undefined"
        :help="errors.confirmation"
      >
        <Input.Password
          v-model:value="draft.confirmation"
          aria-label="确认密码"
          autocomplete="new-password"
          placeholder="请再次输入密码"
        />
      </Form.Item>
      <Button type="primary" html-type="submit" :loading="busy" class="w-full">
        注册
      </Button>
    </Form>
    <p class="mt-4 text-center text-sm">
      <RouterLink
        class="vben-link"
        :to="{ name: 'Login', query: { tenant: draft.tenant.trim() } }"
      >
        返回登录
      </RouterLink>
    </p>
  </div>
</template>
