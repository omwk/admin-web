<script setup lang="ts">
import { reactive, ref } from 'vue';

import { Alert, Button, Form, Input, message } from 'ant-design-vue';

import { changeMyPasswordApi } from '#/api/core/self-service';
import { toApiError } from '#/api/errors';
import { passwordError } from '#/auth/account-link';

const form = reactive({ oldPassword: '', newPassword: '', confirmation: '' });
const busy = ref(false);
const error = ref('');
async function save() {
  if (busy.value) return;
  error.value = '';
  if (!form.oldPassword) {
    error.value = '请输入旧密码';
    return;
  }
  error.value = passwordError(form.newPassword);
  if (error.value) return;
  if (form.newPassword !== form.confirmation) {
    error.value = '两次输入的密码不一致';
    return;
  }
  busy.value = true;
  try {
    await changeMyPasswordApi({
      oldPassword: form.oldPassword,
      newPassword: form.newPassword,
    });
    form.oldPassword = '';
    form.newPassword = '';
    form.confirmation = '';
    message.success('密码修改成功，其他设备的登录已失效');
  } catch (error_) {
    const original = (error_ as { businessMessage?: string })?.businessMessage;
    error.value = original || toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
  <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
    <Form.Item label="旧密码" required>
      <Input.Password
        v-model:value="form.oldPassword"
        aria-label="旧密码"
        autocomplete="current-password"
        :maxlength="1024"
      />
    </Form.Item>
    <Form.Item
      label="新密码"
      required
      help="至少 8 个字符，包含字母和数字，且不超过 72 字节。"
    >
      <Input.Password
        v-model:value="form.newPassword"
        aria-label="新密码"
        autocomplete="new-password"
      />
    </Form.Item>
    <Form.Item label="确认新密码" required>
      <Input.Password
        v-model:value="form.confirmation"
        aria-label="确认新密码"
        autocomplete="new-password"
      />
    </Form.Item>
    <Button html-type="submit" type="primary" :loading="busy">修改密码</Button>
  </Form>
</template>
