<script setup lang="ts">
import type {
  GatewayClient,
  GatewaySecret,
  GatewaySecretMaterial,
} from '#/api/model/gateway';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  InputNumber,
  message,
  Modal,
  Table,
  Tag,
  Typography,
} from 'ant-design-vue';

import {
  createGatewaySecretApi,
  getGatewaySecretsApi,
  revealGatewaySecretApi,
  revokeGatewaySecretApi,
} from '#/api/core/gateway';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';

import { gatewayErrorMessage } from '../shared/gateway-error';
import { secretPrefix, startSecretCountdown } from './options';

const props = defineProps<{ client?: GatewayClient; open: boolean }>();
const emit = defineEmits<{ close: []; updated: [] }>();
const canRotate = computed(() => hasPermission('gateway:client:rotate'));
const canReveal = computed(() => hasPermission('gateway:client:manage'));
const rows = ref<GatewaySecret[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const overlapSeconds = ref(0);
const revealed = ref<GatewaySecretMaterial>();
const secondsRemaining = ref(60);
let stopTimer: (() => void) | undefined;
let sequence = 0;

const columns = [
  { dataIndex: 'secret_prefix', title: '前缀', width: 140 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'last_used_at', title: '最近使用', width: 190 },
  { dataIndex: 'expires_at', title: '过期时间', width: 190 },
  { dataIndex: 'actions', title: '操作', width: 170 },
];

async function load() {
  if (!props.client) return;
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getGatewaySecretsApi(props.client.id);
    if (current === sequence) rows.value = result;
  } catch (error_) {
    if (current === sequence) {
      rows.value = [];
      error.value = gatewayErrorMessage(error_);
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function clearReveal() {
  stopTimer?.();
  stopTimer = undefined;
  revealed.value = undefined;
  secondsRemaining.value = 60;
}

function showReveal(value: GatewaySecretMaterial) {
  clearReveal();
  revealed.value = value;
  stopTimer = startSecretCountdown((remaining) => {
    secondsRemaining.value = remaining;
  }, clearReveal);
}

function close() {
  sequence++;
  rows.value = [];
  error.value = '';
  clearReveal();
  emit('close');
}

function confirmReveal(secret: GatewaySecret) {
  if (!props.client || busy.value || !canReveal.value || !secret.revealable)
    return;
  Modal.confirm({
    title: '查看密钥明文？',
    content: '密钥明文将在页面显示 60 秒，请确认当前屏幕仅由授权人员查看。',
    okText: '查看',
    cancelText: '取消',
    async onOk() {
      if (!props.client) return;
      busy.value = true;
      error.value = '';
      try {
        showReveal(await revealGatewaySecretApi(props.client.id, secret.id));
      } catch (error_) {
        error.value = gatewayErrorMessage(error_);
      } finally {
        busy.value = false;
      }
    },
  });
}

function confirmCreate() {
  if (!props.client || busy.value || !canRotate.value) return;
  Modal.confirm({
    title: '生成新密钥？',
    content: '新密钥仅在弹窗中显示，关闭或 60 秒后无法继续查看。',
    okText: '生成',
    cancelText: '取消',
    async onOk() {
      if (!props.client) return;
      busy.value = true;
      error.value = '';
      try {
        const result = await createGatewaySecretApi(
          props.client.id,
          overlapSeconds.value,
        );
        showReveal(result);
        await load();
        emit('updated');
      } catch (error_) {
        error.value = gatewayErrorMessage(error_);
      } finally {
        busy.value = false;
      }
    },
  });
}

function confirmRevoke(secret: GatewaySecret) {
  if (
    !props.client ||
    busy.value ||
    !canRotate.value ||
    secret.status !== 'active'
  )
    return;
  Modal.confirm({
    title: '吊销密钥？',
    content: `吊销后以 ${secret.secret_prefix} 开头的密钥将无法继续使用。`,
    okType: 'danger',
    okText: '吊销',
    cancelText: '取消',
    async onOk() {
      if (!props.client) return;
      busy.value = true;
      error.value = '';
      try {
        await revokeGatewaySecretApi(props.client.id, secret.id);
        message.success('密钥已吊销');
        await load();
        emit('updated');
      } catch (error_) {
        error.value = gatewayErrorMessage(error_);
      } finally {
        busy.value = false;
      }
    },
  });
}

async function copySecret() {
  if (!revealed.value?.secret) return;
  try {
    await navigator.clipboard.writeText(revealed.value.secret);
    message.success('密钥已复制');
  } catch {
    message.error('复制失败，请手动选择密钥');
  }
}

watch(
  () => [props.open, props.client?.id] as const,
  ([open]) => {
    sequence++;
    clearReveal();
    rows.value = [];
    error.value = '';
    overlapSeconds.value = 0;
    if (open) void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  sequence++;
  clearReveal();
  rows.value = [];
});
</script>

<template>
  <Drawer
    :open="open"
    :title="client ? `密钥 · ${client.name}` : '密钥'"
    :width="680"
    @close="close"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4">
      <template #action>
        <Button size="small" @click="load">重试</Button>
      </template>
    </Alert>
    <div v-if="canRotate" class="mb-4 flex flex-wrap items-end gap-3">
      <div>
        <div class="mb-1 text-xs text-muted-foreground">
          双密钥重叠时间（秒）
        </div>
        <InputNumber
          v-model:value="overlapSeconds"
          aria-label="双密钥重叠时间"
          :min="0"
          :max="86400"
          :precision="0"
          :disabled="busy"
        />
      </div>
      <Button type="primary" :loading="busy" @click="confirmCreate">
        生成新密钥
      </Button>
    </div>
    <Table
      row-key="id"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="{ x: 790 }"
    >
      <template #emptyText>
        <Empty v-if="!loading && !error" description="暂无密钥" />
        <span v-else>{{ error ? '密钥加载失败，请重试' : '正在加载' }}</span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'secret_prefix'">
          <span class="font-mono">{{ record.secret_prefix || '—' }}</span>
        </template>
        <template v-else-if="column.dataIndex === 'status'">
          <Tag :color="record.status === 'active' ? 'green' : 'default'">
            {{ record.status === 'active' ? '启用' : record.status }}
          </Tag>
        </template>
        <template v-else-if="column.dataIndex === 'last_used_at'">
          {{ formatDateTime(record.last_used_at) }}
        </template>
        <template v-else-if="column.dataIndex === 'expires_at'">
          {{ formatDateTime(record.expires_at) }}
        </template>
        <div v-else-if="column.dataIndex === 'actions'" class="flex gap-2">
          <Button
            size="small"
            :disabled="busy || !record.revealable"
            @click="confirmReveal(record as GatewaySecret)"
            v-if="canReveal"
          >
            查看
          </Button>
          <Button
            size="small"
            danger
            :disabled="busy || record.status !== 'active'"
            @click="confirmRevoke(record as GatewaySecret)"
            v-if="canRotate"
          >
            吊销
          </Button>
        </div>
      </template>
    </Table>
    <Modal
      :open="Boolean(revealed)"
      title="密钥明文"
      :footer="null"
      :mask-closable="false"
      @cancel="clearReveal"
    >
      <Alert
        message="密钥仅保存在当前页面内存，关闭或 60 秒后会自动隐藏。"
        type="warning"
        show-icon
        class="mb-4"
      />
      <Typography.Paragraph
        copyable
        :content="revealed?.secret"
        class="break-all font-mono"
      >
        {{ revealed?.secret }}
      </Typography.Paragraph>
      <div class="mb-3 text-xs text-muted-foreground">
        前缀 {{ revealed ? secretPrefix(revealed) || '—' : '—' }}
      </div>
      <div class="flex items-center justify-between">
        <span>剩余 {{ secondsRemaining }} 秒</span>
        <Button @click="copySecret">复制</Button>
      </div>
    </Modal>
  </Drawer>
</template>
