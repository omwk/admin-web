<script setup lang="ts">
import type { Tenant } from '#/api/model/tenant';

import { computed, onDeactivated, onUnmounted, ref } from 'vue';

import { Alert, Button, Modal, Tooltip } from 'ant-design-vue';

import { reissueTenantAdminInviteApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { frontendAccountLink } from '#/auth/account-link';
import { canManageTenants } from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';

import LinkModal from '../shared/link-modal.vue';

const props = defineProps<{ tenant: Tenant; disabled: boolean }>();
const emit = defineEmits<{ busy: [value: boolean]; changed: [] }>();
const confirming = ref(false);
const busy = ref(false);
const error = ref('');
const link = ref('');
const expiresAt = ref('');
let sequence = 0;
const confirmation = computed(
  () =>
    `该租户已有 ${props.tenant.admin_active_count} 个管理员，重发会作废未使用的旧邀请。继续？`,
);

function clear() {
  sequence++;
  confirming.value = false;
  link.value = '';
  expiresAt.value = '';
  error.value = '';
  const wasBusy = busy.value;
  busy.value = false;
  if (wasBusy) emit('busy', false);
}
async function issue(force: boolean) {
  if (
    busy.value ||
    props.disabled ||
    !canManageTenants() ||
    props.tenant.status !== 'active' ||
    (props.tenant.admin_active_count > 0 && !force) ||
    (force && !confirming.value)
  )
    return;
  const current = ++sequence;
  busy.value = true;
  emit('busy', true);
  error.value = '';
  try {
    const result = await reissueTenantAdminInviteApi(props.tenant.id, force);
    if (current !== sequence) return;
    link.value = frontendAccountLink(result.invite_url, window.location.origin);
    expiresAt.value = result.expires_at;
    confirming.value = false;
    emit('changed');
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) {
      busy.value = false;
      emit('busy', false);
    }
  }
}
function start() {
  if (
    busy.value ||
    props.disabled ||
    !canManageTenants() ||
    props.tenant.status !== 'active'
  )
    return;
  error.value = '';
  if (props.tenant.admin_active_count > 0) confirming.value = true;
  else void issue(false);
}
onDeactivated(clear);
onUnmounted(clear);
</script>

<template>
  <template v-if="canManageTenants()">
    <Tooltip :title="tenant.status !== 'active' ? '租户已停用' : undefined">
      <span>
        <Button
          size="small"
          :disabled="disabled || busy || tenant.status !== 'active'"
          :loading="busy"
          @click="start"
        >
          {{ tenant.admin_active_count > 0 ? '重置管理员' : '重发管理员邀请' }}
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
      title="重发管理员邀请"
      ok-text="确认重发"
      cancel-text="取消"
      :confirm-loading="busy"
      :cancel-button-props="{ disabled: busy }"
      :closable="!busy"
      :keyboard="!busy"
      :mask-closable="false"
      @ok="issue(true)"
      @cancel="clear"
    >
      <Alert v-if="error" :message="error" type="error" class="mb-4" />
      <p>
        {{ confirmation }}
      </p>
    </Modal>
    <LinkModal
      v-if="link"
      :open="true"
      :link="link"
      title="邀请链接（仅本次显示）"
      :description="`租户 ID：${tenant.id}。邀请链接有效期至 ${formatDateTime(expiresAt)}，仅可使用一次。对方的密码由本人设置，你无法看到。关闭后链接即丢弃；如需重发，请在租户列表重新签发。`"
      @close="clear"
    />
  </template>
</template>
