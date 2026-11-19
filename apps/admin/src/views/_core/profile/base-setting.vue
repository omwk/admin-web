<script setup lang="ts">
import type { IdentityUser, ProfileInput } from '#/api/model/identity';

import { computed, reactive, ref } from 'vue';

import { Alert, Avatar, Button, Form, Input, message } from 'ant-design-vue';

import { changeMyEmailApi, updateMyProfileApi } from '#/api/core/self-service';
import { toApiError } from '#/api/errors';

const props = defineProps<{ profile: IdentityUser }>();
const emit = defineEmits<{
  saved: [profile: Pick<IdentityUser, 'avatar' | 'nickname' | 'phone'>];
}>();
const form = reactive({
  nickname: props.profile.nickname || '',
  email: props.profile.email || '',
  phone: props.profile.phone || '',
  avatar: props.profile.avatar || '',
});
const busy = ref(false);
const error = ref('');
const fields = reactive({ email: '', phone: '', avatar: '' });
const pendingEmail = ref('');
const avatarPreview = computed(() => {
  try {
    const url = new URL(form.avatar.trim());
    return ['http:', 'https:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
});
async function save() {
  if (busy.value) return;
  error.value = '';
  fields.email = '';
  fields.phone = '';
  fields.avatar = '';
  const email = form.email.trim().toLowerCase();
  const emailChanged =
    email !== (props.profile.email || '').trim().toLowerCase();
  const phone = form.phone.trim();
  const avatar = form.avatar.trim();
  if ((email || emailChanged) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    fields.email = '请输入有效的邮箱地址';
  if (phone && !/^\+[1-9]\d{1,14}$/.test(phone))
    fields.phone =
      '请输入 E.164 格式的手机号，须以 + 和国家代码开头，最多 15 位数字';
  if (avatar && !avatarPreview.value)
    fields.avatar = '头像须为 HTTP 或 HTTPS 地址';
  if (fields.email || fields.phone || fields.avatar) return;
  const input: ProfileInput = {
    nickname: form.nickname,
    avatar,
    ...(props.profile.phone !== undefined || phone ? { phone } : {}),
  };
  const phoneChanged = phone !== (props.profile.phone || '');
  busy.value = true;
  let changingEmail = false;
  try {
    const saved = await updateMyProfileApi(input);
    emit('saved', {
      nickname: saved.nickname,
      avatar: saved.avatar,
      phone: input.phone ?? props.profile.phone,
    });
    message.success(
      phoneChanged
        ? '手机号已更新，仅用于联系，不用于短信通知'
        : '基本信息已保存',
    );
    if (emailChanged && email !== pendingEmail.value) {
      changingEmail = true;
      await changeMyEmailApi(email);
      pendingEmail.value = email;
      message.success('验证邮件已发送到新邮箱，24 小时内有效');
    }
  } catch (error_) {
    const failure = toApiError(error_);
    if (changingEmail) fields.email = failure.message;
    else if (
      [400, 409].includes(failure.status || 0) &&
      /手机|phone/i.test(failure.message)
    )
      fields.phone = failure.message;
    else error.value = failure.message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
  <Alert
    v-if="pendingEmail"
    type="success"
    message="验证邮件已发送到新邮箱，24 小时内有效"
    :description="`请前往 ${pendingEmail} 完成验证；验证前仍使用当前邮箱。`"
    show-icon
    class="mb-4"
  />
  <Form
    layout="vertical"
    :model="form"
    :disabled="busy"
    novalidate
    @finish="save"
  >
    <Form.Item label="用户名">
      <Input :value="profile.username" aria-label="用户名" disabled />
    </Form.Item>
    <Form.Item label="昵称">
      <Input v-model:value="form.nickname" aria-label="昵称" :maxlength="256" />
    </Form.Item>
    <Form.Item
      label="邮箱"
      :validate-status="fields.email ? 'error' : undefined"
      :help="fields.email || '新邮箱验证后生效，验证前仍使用当前邮箱登录。'"
    >
      <Input
        v-model:value="form.email"
        aria-label="邮箱"
        :aria-invalid="!!fields.email"
        type="email"
        :maxlength="256"
        autocomplete="email"
      />
    </Form.Item>
    <Form.Item
      label="手机"
      :validate-status="fields.phone ? 'error' : undefined"
      :help="fields.phone || '仅用于联系，不用于短信通知'"
    >
      <Input
        v-model:value="form.phone"
        aria-label="手机"
        :aria-invalid="!!fields.phone"
        type="tel"
        :maxlength="32"
        autocomplete="tel"
      />
    </Form.Item>
    <Form.Item
      label="头像 URL"
      :validate-status="fields.avatar ? 'error' : undefined"
      :help="fields.avatar"
    >
      <div class="flex items-center gap-3">
        <Avatar
          :src="avatarPreview"
          :size="64"
          shape="circle"
          alt="头像预览"
          class="shrink-0"
        >
          {{ form.nickname.slice(0, 1) || profile.username.slice(0, 1) }}
        </Avatar>
        <Input
          v-model:value="form.avatar"
          aria-label="头像 URL"
          :aria-invalid="!!fields.avatar"
          placeholder="https://example.com/avatar.png"
          :maxlength="2048"
        />
      </div>
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
