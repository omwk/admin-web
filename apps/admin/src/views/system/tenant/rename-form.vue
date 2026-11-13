<script setup lang="ts">
import type { Tenant } from '#/api/model/tenant';

import { ref } from 'vue';

import { Alert, Button, Form, Input, Modal, Space } from 'ant-design-vue';

import { renameTenantApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants, platformTenantId } from '#/auth/tenant';

const props = defineProps<{ tenant: Tenant }>();
const emit = defineEmits<{ close: []; saved: []; busy: [value: boolean] }>();
const name = ref(props.tenant.name);
const busy = ref(false);
const error = ref('');
async function save() {
  if (busy.value || !canManageTenants() || props.tenant.id === platformTenantId)
    return;
  error.value = '';
  if (!name.value.trim() || [...name.value].length > 128) {
    error.value = '名称须为 1–128 字符';
    return;
  }
  busy.value = true;
  emit('busy', true);
  try {
    await renameTenantApi(props.tenant.id, { name: name.value });
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
</script>

<template>
  <Modal
    :open="true"
    title="编辑租户名称"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="{ name }" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item label="租户 Code" help="创建后不可修改">
        <Input :value="tenant.code" aria-label="租户 Code" disabled />
      </Form.Item>
      <Form.Item label="租户名称" required>
        <Input v-model:value="name" aria-label="租户名称" :maxlength="128" />
      </Form.Item>
      <Space>
        <Button
          v-if="canManageTenants()"
          type="primary"
          html-type="submit"
          :loading="busy"
        >
          保存名称
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
