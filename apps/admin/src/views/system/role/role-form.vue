<script setup lang="ts">
import type { AdminRole, RoleInput } from '#/api/model/system';

import { reactive, ref } from 'vue';

import { Alert, Form, Input, Modal, Select } from 'ant-design-vue';

import { createRoleApi, updateRoleApi } from '#/api/core/system';
import { toApiError } from '#/api/errors';

import { dataScopeOptions } from './role-options';

const props = defineProps<{ role?: AdminRole }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const form = reactive<Omit<RoleInput, 'remark'> & { remark: string }>({
  code: props.role?.code ?? '',
  name: props.role?.name ?? '',
  data_scope: props.role?.data_scope ?? 'self',
  remark: props.role?.remark ?? '',
  status: props.role?.status ?? 'active',
});
const busy = ref(false);
const error = ref('');
async function save() {
  error.value = '';
  if (!form.code.trim() || !form.name.trim()) {
    error.value = '请填写角色编码和名称';
    return;
  }
  busy.value = true;
  try {
    const input = {
      ...form,
      code: form.code.trim(),
      name: form.name.trim(),
      remark: form.remark?.trim() || null,
    };
    await (props.role
      ? updateRoleApi(props.role.id, input)
      : createRoleApi(input));
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
    :title="role ? '编辑角色' : '新建角色'"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" class="mb-4" show-icon />
    <Form layout="vertical" :disabled="busy">
      <Form.Item label="角色编码" required>
        <Input
          v-model:value="form.code"
          aria-label="角色编码"
          :maxlength="64"
        />
      </Form.Item>
      <Form.Item label="角色名称" required>
        <Input
          v-model:value="form.name"
          aria-label="角色名称"
          :maxlength="256"
        />
      </Form.Item>
      <Form.Item label="数据范围">
        <Select
          v-model:value="form.data_scope"
          aria-label="角色数据范围"
          :options="dataScopeOptions"
        />
      </Form.Item>
      <Form.Item label="状态">
        <Select
          v-model:value="form.status"
          aria-label="角色状态"
          :options="[
            { label: '启用', value: 'active' },
            { label: '禁用', value: 'disabled' },
          ]"
        />
      </Form.Item>
      <Form.Item label="备注">
        <Input.TextArea
          v-model:value="form.remark"
          aria-label="角色备注"
          :maxlength="2048"
        />
      </Form.Item>
    </Form>
  </Modal>
</template>
