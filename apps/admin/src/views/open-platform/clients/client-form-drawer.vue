<script setup lang="ts">
import type { AdminUser } from '#/api/model/admin-user';
import type { GatewayClient, GatewayClientCreated } from '#/api/model/gateway';

import { reactive, ref, watch } from 'vue';

import { Alert, Button, Drawer, Form, Input, Select } from 'ant-design-vue';

import {
  createGatewayClientApi,
  updateGatewayClientApi,
} from '#/api/core/gateway';

import { gatewayErrorMessage } from '../shared/gateway-error';

const props = defineProps<{
  client?: GatewayClient;
  open: boolean;
  users: AdminUser[];
}>();
const emit = defineEmits<{
  close: [];
  created: [result: GatewayClientCreated];
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
  () => [props.open, props.client] as const,
  ([open, client]) => {
    if (!open) return;
    draft.name = client?.name ?? '';
    draft.ip_whitelist = client?.ip_whitelist?.join('\n') ?? '';
    draft.owner_user_id = client?.owner_user_id;
    draft.status = client?.status ?? 'active';
    error.value = '';
  },
  { immediate: true },
);

async function save() {
  error.value = '';
  if (!draft.name.trim()) {
    error.value = '请填写客户端名称';
    return;
  }
  if (draft.name.trim().length > 100) {
    error.value = '客户端名称不能超过 100 个字符';
    return;
  }
  const ownerUserId = draft.owner_user_id;
  if (!props.client && ownerUserId === undefined) {
    error.value = '请选择所属用户';
    return;
  }
  busy.value = true;
  try {
    const ip_whitelist = draft.ip_whitelist
      .split(/[\n,]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (props.client) {
      await updateGatewayClientApi(props.client.id, {
        status: draft.status,
        version: props.client.version,
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
    error.value = gatewayErrorMessage(error_);
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
    <Alert
      v-if="client"
      type="info"
      show-icon
      message="当前后端仅支持修改客户端状态。名称和 IP 白名单更新待 BE-IDN-034。"
      class="mb-4"
    />
    <Form layout="vertical" :disabled="busy" autocomplete="off">
      <Form.Item label="名称" required>
        <Input
          v-model:value="draft.name"
          aria-label="客户端名称"
          :disabled="Boolean(client)"
          :maxlength="100"
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
      <Form.Item label="IP 白名单">
        <Input
          v-model:value="draft.ip_whitelist"
          aria-label="IP 白名单"
          :disabled="Boolean(client)"
          placeholder="每行一个 IP 或 CIDR，可留空"
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
