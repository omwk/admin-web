<script setup lang="ts">
import type { IdentityUser, ProfileInput } from '#/api/model/identity';

import { reactive, ref } from 'vue';

import { Alert, Button, Form, Input, message } from 'ant-design-vue';

import { updateMyProfileApi } from '#/api/core/self-service';
import { toApiError } from '#/api/errors';

const props = defineProps<{ profile: IdentityUser }>();
const emit = defineEmits<{ saved: [] }>();
const form = reactive({
  nickname: props.profile.nickname || '',
  email: props.profile.email || '',
  phone: props.profile.phone || '',
  avatar: props.profile.avatar || '',
});
const emailKnown = props.profile.email !== undefined;
const emailChanged = ref(false);
const busy = ref(false);
const error = ref('');
async function save() {
  if (busy.value) return;
  error.value = '';
  const email = form.email.trim();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    error.value = '请输入有效的邮箱地址';
    return;
  }
  const avatar = form.avatar.trim();
  if (avatar) {
    try {
      if (!['http:', 'https:'].includes(new URL(avatar).protocol))
        throw new Error('Avatar URL must use HTTP or HTTPS');
    } catch {
      error.value = '头像须为 HTTP 或 HTTPS 地址';
      return;
    }
  }
  const input: ProfileInput = {
    nickname: form.nickname,
    avatar,
    ...(emailKnown || emailChanged.value ? { email } : {}),
  };
  busy.value = true;
  try {
    await updateMyProfileApi(input);
    message.success(
      email !== (props.profile.email || '') &&
        (emailKnown || emailChanged.value)
        ? '基本信息已保存，下次登录可使用新邮箱'
        : '基本信息已保存',
    );
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
  <Form layout="vertical" :model="form" :disabled="busy" @finish="save">
    <Form.Item label="用户名">
      <Input :value="profile.username" aria-label="用户名" disabled />
    </Form.Item>
    <Form.Item label="昵称">
      <Input v-model:value="form.nickname" aria-label="昵称" :maxlength="256" />
    </Form.Item>
    <Form.Item label="邮箱" help="保存后可使用新邮箱登录；当前登录会话保留。">
      <Input
        v-model:value="form.email"
        aria-label="邮箱"
        type="email"
        :maxlength="256"
        autocomplete="email"
        @change="emailChanged = true"
      />
    </Form.Item>
    <Form.Item label="手机" help="手机暂不可修改，请联系管理员。">
      <Input
        v-model:value="form.phone"
        aria-label="手机"
        disabled
        :maxlength="32"
        autocomplete="tel"
      />
    </Form.Item>
    <Form.Item label="头像 URL">
      <Input
        v-model:value="form.avatar"
        aria-label="头像 URL"
        placeholder="https://example.com/avatar.png"
        :maxlength="2048"
      />
    </Form.Item>
    <Form.Item label="部门">
      <Input
        :value="
          profile.dept_name ||
          (profile.dept_id ? `部门 #${profile.dept_id}` : '未分配')
        "
        aria-label="部门"
        disabled
      />
    </Form.Item>
    <Form.Item label="角色">
      <Input
        :value="profile.roles.map((role) => role.name).join('、') || '未分配'"
        aria-label="角色"
        disabled
      />
    </Form.Item>
    <Form.Item label="租户">
      <Input
        :value="profile.tenant_code || `租户 #${profile.tenant_id}`"
        aria-label="租户"
        disabled
      />
    </Form.Item>
    <Button html-type="submit" type="primary" :loading="busy">
      保存基本信息
    </Button>
  </Form>
</template>
