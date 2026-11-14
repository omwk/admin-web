<script setup lang="ts">
import { computed, ref } from 'vue';
import { RouterLink, useRoute, useRouter } from 'vue-router';

import { Alert, Button, Form, Input, Result } from 'ant-design-vue';

import { acceptInviteApi, consumeResetLinkApi } from '#/api/core/invites';
import { toApiError } from '#/api/errors';
import { passwordError } from '#/auth/account-link';

const props = defineProps<{ complete?: boolean; mode: 'invite' | 'reset' }>();
const route = useRoute();
const router = useRouter();
const credential = ref(
  new URLSearchParams(route.hash.replace(/^#/, '')).get('token') ?? '',
);
const tenant = Number(route.query.tenant_id);
const username = ref('');
const password = ref('');
const confirmation = ref('');
const busy = ref(false);
const done = computed(() => Boolean(props.complete));
const error = ref('');
const validLink = computed(
  () => Boolean(credential.value) && Number.isSafeInteger(tenant) && tenant > 0,
);
const title = computed(() =>
  props.mode === 'invite' ? '接受邀请' : '设置新密码',
);
async function submit() {
  error.value = passwordError(password.value);
  if (error.value) return;
  if (password.value !== confirmation.value) {
    error.value = '两次密码输入不一致';
    return;
  }
  if (!validLink.value) {
    error.value = '链接不完整，请联系管理员重新生成';
    return;
  }
  if (props.mode === 'invite' && !username.value.trim()) {
    error.value = '请填写用户名';
    return;
  }
  busy.value = true;
  try {
    await (props.mode === 'invite'
      ? acceptInviteApi({
          password: password.value,
          tenant_id: tenant,
          token: credential.value,
          username: username.value.trim(),
        })
      : consumeResetLinkApi({
          newPassword: password.value,
          tenant_id: tenant,
          token: credential.value,
        }));
    credential.value = '';
    password.value = '';
    confirmation.value = '';
    await router.replace({
      name: 'AccountLinkComplete',
      query: { mode: props.mode, tenant_id: tenant },
    });
  } catch (error_) {
    const failure = toApiError(error_);
    error.value =
      failure.status === 400
        ? '链接无效、已使用或已过期，或账号密码不符合要求。请检查输入，或联系管理员重新生成链接。'
        : failure.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <div class="mx-auto w-full max-w-md">
    <Result
      v-if="done"
      status="success"
      :title="mode === 'invite' ? '账号已创建' : '密码已更新'"
      sub-title="请使用本人设置的密码和管理员提供的企业代码登录。"
    >
      <template #extra>
        <RouterLink
          :to="{
            path: '/auth/login',
            query: { tenant: route.query.tenant },
          }"
        >
          <Button type="primary">前往登录</Button>
        </RouterLink>
      </template>
    </Result>
    <template v-else>
      <h1 class="mb-4 text-2xl font-semibold">{{ title }}</h1>
      <Alert
        v-if="!validLink"
        message="链接不完整，请联系管理员重新生成。"
        type="error"
        show-icon
        class="mb-4"
      />
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <Alert
        v-if="mode === 'invite'"
        message="部门与角色由邀请人预置。请自行设置密码，管理员无法看到。"
        type="info"
        class="mb-4"
      />
      <Form
        layout="vertical"
        :model="{ username, password, confirmation }"
        :disabled="busy || !validLink"
        :colon="false"
        @finish="submit"
      >
        <Form.Item v-if="mode === 'invite'" label="用户名" required>
          <Input
            v-model:value="username"
            aria-label="用户名"
            :maxlength="256"
            autocomplete="username"
          />
        </Form.Item>
        <Form.Item label="新密码" required>
          <Input.Password
            v-model:value="password"
            aria-label="新密码"
            autocomplete="new-password"
            placeholder="至少 8 个字符，包含字母和数字"
          />
        </Form.Item>
        <Form.Item label="确认密码" required>
          <Input.Password
            v-model:value="confirmation"
            aria-label="确认密码"
            autocomplete="new-password"
          />
        </Form.Item>
        <Button
          type="primary"
          html-type="submit"
          block
          :loading="busy"
          :disabled="!validLink"
        >
          {{ mode === 'invite' ? '创建账号' : '更新密码' }}
        </Button>
      </Form>
    </template>
  </div>
</template>
