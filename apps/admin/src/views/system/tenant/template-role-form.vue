<script setup lang="ts">
import type { TenantTemplateRole } from '#/api/model/tenant';

import { reactive, ref } from 'vue';

import { Alert, Button, Form, Input, Modal, Space } from 'ant-design-vue';

import { validateTemplateRole } from './template-editor-state';

const props = defineProps<{ codes: string[]; menuKeys: string[] }>();
const emit = defineEmits<{ close: []; added: [role: TenantTemplateRole] }>();
const form = reactive({ code: '', name: '' });
const error = ref('');
function add() {
  error.value = validateTemplateRole(form.code, form.name, props.codes);
  if (props.codes.length >= 50) error.value = '每个模板最多 50 个角色';
  if (error.value) return;
  emit('added', {
    ...form,
    name: form.name.trim(),
    data_scope: 'self',
    status: 'active',
    remark: null,
    permissions: [],
    menus: [...props.menuKeys],
  });
}
</script>

<template>
  <Modal
    :open="true"
    title="添加模板角色"
    :footer="null"
    :mask-closable="false"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="form" layout="vertical" @finish="add">
      <Form.Item
        label="角色 Code"
        help="小写字母开头，仅含小写字母、数字或下划线；创建后不可修改"
        required
      >
        <Input
          v-model:value="form.code"
          aria-label="新角色 Code"
          :maxlength="64"
        />
      </Form.Item>
      <Form.Item label="角色名" required>
        <Input
          v-model:value="form.name"
          aria-label="新角色名"
          :maxlength="128"
        />
      </Form.Item>
      <Space>
        <Button type="primary" html-type="submit">添加</Button>
        <Button @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
