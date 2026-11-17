<script setup lang="ts">
import type { Tenant } from '#/api/model/tenant';

import { computed, onDeactivated, ref, watch } from 'vue';

import { Alert, Button, Input, message, Modal, Tooltip } from 'ant-design-vue';

import {
  archiveTenantApi,
  deleteTenantApi,
  restoreTenantApi,
} from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants, platformTenantId } from '#/auth/tenant';

const props = defineProps<{ tenant: Tenant; disabled: boolean }>();
const emit = defineEmits<{ changed: []; busy: [value: boolean] }>();
const confirming = ref<'archive' | 'delete'>();
const confirmation = ref('');
const busy = ref(false);
const error = ref('');
const archived = computed(() => Boolean(props.tenant.deleted_at));
const platform = computed(() => props.tenant.id === platformTenantId);
const matches = computed(() => confirmation.value === props.tenant.code);

function clear() {
  confirming.value = undefined;
  confirmation.value = '';
  error.value = '';
}
function start(action: 'archive' | 'delete') {
  if (busy.value || props.disabled || !canManageTenants() || platform.value)
    return;
  clear();
  confirming.value = action;
}
async function run(action: 'archive' | 'delete' | 'restore') {
  if (
    busy.value ||
    props.disabled ||
    !canManageTenants() ||
    (action !== 'restore' && platform.value) ||
    (action === 'archive' ? archived.value : !archived.value) ||
    (action === 'archive' && confirming.value !== 'archive') ||
    (action === 'delete' && (confirming.value !== 'delete' || !matches.value))
  )
    return;
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    if (action === 'archive') await archiveTenantApi(props.tenant.id);
    else if (action === 'restore') await restoreTenantApi(props.tenant.id);
    else await deleteTenantApi(props.tenant.id, confirmation.value);
    clear();
    message.success(
      { archive: '租户已归档', restore: '租户已恢复', delete: '租户已删除' }[
        action
      ],
    );
    emit('changed');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
watch(() => [props.tenant.id, props.tenant.deleted_at], clear);
onDeactivated(clear);
</script>

<template>
  <template v-if="canManageTenants()">
    <Button
      v-if="archived"
      size="small"
      :disabled="disabled || busy"
      @click="run('restore')"
    >
      恢复
    </Button>
    <Tooltip :title="platform ? '平台租户不可归档/删除' : undefined">
      <span>
        <Button
          size="small"
          danger
          :disabled="platform || disabled || busy"
          @click="start(archived ? 'delete' : 'archive')"
        >
          {{ archived ? '彻底删除' : '归档' }}
        </Button>
      </span>
    </Tooltip>
    <Alert
      v-if="error && !confirming"
      :message="error"
      type="error"
      class="mt-2"
    />
    <Modal
      v-if="confirming"
      :open="true"
      :title="
        confirming === 'archive' ? `归档「${tenant.code}」？` : '彻底删除租户'
      "
      :ok-text="confirming === 'archive' ? '确认归档' : '删除'"
      cancel-text="取消"
      ok-type="danger"
      :ok-button-props="{
        disabled: disabled || (confirming === 'delete' && !matches),
      }"
      :confirm-loading="busy"
      :cancel-button-props="{ disabled: busy }"
      :closable="!busy"
      :keyboard="!busy"
      :mask-closable="false"
      @ok="run(confirming)"
      @cancel="clear"
    >
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <template v-if="confirming === 'archive'">
        <p>归档「{{ tenant.code }}」后：</p>
        <ul class="my-3 list-inside list-disc space-y-2">
          <li>该租户用户立即无法登录</li>
          <li>租户从列表隐藏（可勾选「包含已归档」查看）</li>
          <li>数据保留，可随时恢复</li>
        </ul>
      </template>
      <template v-else>
        <p class="mb-4">
          此操作不可恢复，将删除该租户下的用户、角色、菜单、字典、令牌等全部数据。
        </p>
        <label for="tenant-delete-confirmation" class="mb-2 block">
          请输入租户代码 <strong>{{ tenant.code }}</strong> 以确认：
        </label>
        <Input
          id="tenant-delete-confirmation"
          v-model:value="confirmation"
          aria-label="租户代码确认"
          autocomplete="off"
          :disabled="busy"
          @press-enter="run('delete')"
        />
      </template>
    </Modal>
  </template>
</template>
