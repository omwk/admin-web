<script setup lang="ts">
import type { AdminUser } from '#/api/model/admin-user';
import type { GatewayClient, GatewayClientCreated } from '#/api/model/gateway';

import { reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  Modal,
  Select,
} from 'ant-design-vue';

import {
  createGatewayClientApi,
  updateGatewayClientApi,
} from '#/api/core/gateway';

import {
  gatewayClientSaveError,
  isGatewayVersionConflict,
} from '../shared/gateway-error';
import { parseIpWhitelist } from './options';

const props = defineProps<{
  client?: GatewayClient;
  open: boolean;
  users: AdminUser[];
}>();
const emit = defineEmits<{
  close: [];
  created: [result: GatewayClientCreated];
  refresh: [clientId: number];
  saved: [];
}>();
const draft = reactive({
  ip_whitelist: '',
  name: '',
  owner_user_id: undefined as number | undefined,
  status: 'active' as GatewayClient['status'],
});
const busy = ref(false);
const error = ref('');

watch(
  () => [props.open, props.client?.id] as const,
  ([open]) => {
    if (!open) return;
    const client = props.client;
    draft.name = client?.name ?? '';
    draft.ip_whitelist = client?.ip_whitelist?.join('\n') ?? '';
    draft.owner_user_id = client?.owner_user_id;
    draft.status = client?.status ?? 'active';
    error.value = '';
  },
  { immediate: true },
);

function confirmAllowAllIps() {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title: '清空 IP 白名单？',
      content: '清空后将允许所有 IP 访问该客户端。',
      okText: '确认清空',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => resolve(true),
      onCancel: () => resolve(false),
    });
  });
}

async function save() {
  error.value = '';
  if (!draft.name.trim()) {
    error.value = '请填写客户端名称';
    return;
  }
  const maxNameLength = props.client ? 200 : 100;
  if (draft.name.trim().length > maxNameLength) {
    error.value = `客户端名称不能超过 ${maxNameLength} 个字符`;
    return;
  }
  const ownerUserId = draft.owner_user_id;
  if (!props.client && ownerUserId === undefined) {
    error.value = '请选择所属用户';
    return;
  }
  const client = props.client;
  const ip_whitelist = parseIpWhitelist(draft.ip_whitelist);
  if (client?.ip_whitelist.length && ip_whitelist.length === 0) {
    busy.value = true;
    const confirmed = await confirmAllowAllIps();
    if (!confirmed) {
      busy.value = false;
      return;
    }
  } else busy.value = true;
  try {
    if (client) {
      await updateGatewayClientApi(client.id, {
        ip_whitelist,
        name: draft.name.trim(),
        status: draft.status,
        version: client.version,
      });
      emit('saved');
    } else if (ownerUserId !== undefined) {
      const result = await createGatewayClientApi({
        ip_whitelist,
        name: draft.name.trim(),
        owner_user_id: ownerUserId,
      });
      emit('created', result);
    }
    emit('close');
  } catch (error_) {
    error.value = gatewayClientSaveError(error_);
    if (client && isGatewayVersionConflict(error_)) emit('refresh', client.id);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="client ? '编辑客户端' : '新建客户端'"
    :width="520"
    :closable="!busy"
    :mask-closable="false"
    @close="emit('close')"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4" />
    <Form layout="vertical" :disabled="busy" autocomplete="off">
      <Form.Item label="名称" required>
        <Input
          v-model:value="draft.name"
          aria-label="客户端名称"
          :maxlength="client ? 200 : 100"
        />
      </Form.Item>
      <Form.Item v-if="!client" label="所属用户" required>
        <Select
          v-model:value="draft.owner_user_id"
          aria-label="所属用户"
          :options="
            users.map((user: AdminUser) => ({
              label: `${user.username} (#${user.id})`,
              value: user.id,
            }))
          "
          show-search
          option-filter-prop="label"
          placeholder="选择本租户用户"
        />
      </Form.Item>
      <Form.Item
        label="IP 白名单"
        help="每行一个 IP 或网段，例如 10.0.0.0/8、192.168.1.10。留空将允许所有 IP。"
      >
        <Input.TextArea
          v-model:value="draft.ip_whitelist"
          aria-label="IP 白名单"
          :rows="4"
          placeholder="每行输入一个 IP 或网段"
          :maxlength="2048"
        />
      </Form.Item>
      <Form.Item v-if="client" label="状态" required>
        <Select
          v-model:value="draft.status"
          aria-label="客户端状态"
          :options="[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'suspended' },
          ]"
        />
      </Form.Item>
    </Form>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button :disabled="busy" @click="emit('close')">取消</Button>
        <Button type="primary" :loading="busy" @click="save">保存</Button>
      </div>
    </template>
  </Drawer>
</template>
