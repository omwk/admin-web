<script setup lang="ts">
import type { Tenant } from '#/api/model/tenant';

import { ref } from 'vue';

import { Alert, Button, message, Modal, Space, Tooltip } from 'ant-design-vue';

import { disableTenantApi, enableTenantApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants, platformTenantId } from '#/auth/tenant';

import AdminInvite from './admin-invite.vue';
import RenameForm from './rename-form.vue';

const props = defineProps<{ tenant: Tenant; disabled: boolean }>();
const emit = defineEmits<{
  changed: [];
  busy: [value: boolean];
  members: [];
}>();
const confirming = ref(false);
const renaming = ref(false);
const busy = ref(false);
const error = ref('');
async function changeStatus(disable: boolean) {
  if (
    busy.value ||
    props.disabled ||
    !canManageTenants() ||
    (disable && props.tenant.id === platformTenantId)
  )
    return;
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    await (disable
      ? disableTenantApi(props.tenant.id)
      : enableTenantApi(props.tenant.id));
    confirming.value = false;
    message.success(disable ? '租户已停用' : '租户已启用');
    emit('changed');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
function renamed() {
  renaming.value = false;
  message.success('名称已保存');
  emit('changed');
}
</script>

<template>
  <Space wrap>
    <Button size="small" :disabled="disabled || busy" @click="emit('members')">
      查看成员
    </Button>
    <template v-if="canManageTenants()">
      <AdminInvite
        :tenant="tenant"
        :disabled="disabled || busy"
        @busy="emit('busy', $event)"
        @changed="emit('changed')"
      />
      <Button
        v-if="tenant.id !== platformTenantId"
        size="small"
        :disabled="disabled || busy"
        @click="renaming = true"
      >
        编辑名称
      </Button>
      <Tooltip v-if="tenant.id === platformTenantId" title="平台租户不可停用">
        <span><Button size="small" danger disabled>停用</Button></span>
      </Tooltip>
      <Button
        v-else-if="tenant.status === 'active'"
        size="small"
        danger
        :disabled="disabled || busy"
        @click="
          error = '';
          confirming = true;
        "
      >
        停用
      </Button>
      <Button
        v-else
        size="small"
        :disabled="disabled"
        :loading="busy"
        @click="changeStatus(false)"
      >
        启用
      </Button>
    </template>
  </Space>
  <template v-if="canManageTenants()">
    <Alert
      v-if="error && !confirming"
      :message="error"
      type="error"
      class="mt-2"
    />
    <Modal
      v-if="confirming"
      :open="true"
      :title="`停用「${tenant.name}」？`"
      ok-text="确认停用"
      cancel-text="取消"
      ok-type="danger"
      :confirm-loading="busy"
      :cancel-button-props="{ disabled: busy }"
      :closable="!busy"
      :keyboard="!busy"
      :mask-closable="false"
      @ok="changeStatus(true)"
      @cancel="confirming = false"
    >
      <Alert v-if="error" :message="error" type="error" class="mb-4" />
      <p>停用「{{ tenant.name }}」后：</p>
      <ul class="my-3 list-inside list-disc space-y-2">
        <li>该租户所有用户无法登录</li>
        <li>已登录会话的刷新令牌将被拒绝</li>
        <li>数据保留，可随时重新启用</li>
      </ul>
    </Modal>
    <RenameForm
      v-if="renaming"
      :tenant="tenant"
      @close="renaming = false"
      @busy="emit('busy', $event)"
      @saved="renamed"
    />
  </template>
</template>
