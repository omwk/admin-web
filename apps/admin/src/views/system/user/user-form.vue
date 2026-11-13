<script setup lang="ts">
import type { AdminUser, UserStatus } from '#/api/model/admin-user';
import type { Department } from '#/api/model/system';

import { computed, reactive, ref } from 'vue';

import { Alert, Form, Input, Modal, Select, TreeSelect } from 'ant-design-vue';

import { createUserApi, updateUserApi } from '#/api/core/admin-users';
import { toApiError } from '#/api/errors';
import { passwordError } from '#/auth/account-link';
import { useMetaDictionary } from '#/composables/use-meta-dictionary';

import { treeOptions } from '../shared/tree';

const props = defineProps<{ departments: Department[]; user?: AdminUser }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const form = reactive({
  avatar: props.user?.avatar ?? '',
  dept_id: props.user?.dept_id,
  email: props.user?.email ?? '',
  nickname: props.user?.nickname ?? '',
  password: '',
  status: props.user?.status ?? ('active' as UserStatus),
  username: props.user?.username ?? '',
});
const busy = ref(false);
const dictionary = useMetaDictionary('user_status');
const error = ref('');
const departments = computed(() => treeOptions(props.departments));
async function save() {
  error.value = '';
  if (!form.dept_id || (!props.user && !form.username.trim())) {
    error.value = '请填写用户名并选择部门';
    return;
  }
  if (!props.user && passwordError(form.password)) {
    error.value = passwordError(form.password);
    return;
  }
  if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
    error.value = '请输入有效邮箱';
    return;
  }
  busy.value = true;
  const input = {
    avatar: form.avatar.trim() || null,
    dept_id: form.dept_id,
    email: form.email.trim() || null,
    nickname: form.nickname.trim() || null,
    status: form.status,
  };
  try {
    await (props.user
      ? updateUserApi(props.user.id, input)
      : createUserApi({
          ...input,
          username: form.username.trim(),
          password: form.password,
        }));
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    open
    :title="user ? '编辑用户' : '直接建号'"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4" />
    <Alert
      v-if="!user"
      message="初始密码由管理员设置，账号将标记为需要本人修改密码。推荐通过邀请由本人设置密码。"
      type="info"
      class="mb-4"
    />
    <Form layout="vertical" :disabled="busy">
      <Form.Item label="用户名" required>
        <Input
          v-model:value="form.username"
          aria-label="用户名"
          :disabled="Boolean(user)"
          :maxlength="256"
        />
      </Form.Item>
      <Form.Item v-if="!user" label="初始密码" required>
        <Input.Password
          v-model:value="form.password"
          aria-label="初始密码"
          autocomplete="new-password"
        />
      </Form.Item>
      <Form.Item label="昵称">
        <Input
          v-model:value="form.nickname"
          aria-label="昵称"
          :maxlength="256"
        />
      </Form.Item>
      <Form.Item label="邮箱">
        <Input v-model:value="form.email" aria-label="邮箱" :maxlength="256" />
      </Form.Item>
      <Form.Item label="头像 URL">
        <Input
          v-model:value="form.avatar"
          aria-label="头像 URL"
          :maxlength="2048"
        />
      </Form.Item>
      <Form.Item label="部门" required>
        <TreeSelect
          v-model:value="form.dept_id"
          aria-label="部门"
          :tree-data="departments"
          tree-default-expand-all
          show-search
          tree-node-filter-prop="title"
        />
      </Form.Item>
      <Form.Item label="状态" required>
        <Select
          v-model:value="form.status"
          aria-label="用户状态"
          :options="dictionary.options.value"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
