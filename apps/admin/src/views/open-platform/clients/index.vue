<script setup lang="ts">
import type { AdminUser } from '#/api/model/admin-user';
import type {
  GatewayClient,
  GatewayClientCreated,
  GatewayInfo,
  GatewaySecretMaterial,
} from '#/api/model/gateway';

import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Table,
  Tag,
  Typography,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import { getUsersApi } from '#/api/core/admin-users';
import {
  getGatewayCallsApi,
  getGatewayClientsApi,
  getGatewayInfoApi,
  updateGatewayClientApi,
} from '#/api/core/gateway';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { gatewayErrorMessage } from '../shared/gateway-error';
import ClientFormDrawer from './client-form-drawer.vue';
import GrantsDrawer from './grants-drawer.vue';
import { startSecretCountdown } from './options';
import SecretsDrawer from './secrets-drawer.vue';
import TryDrawer from './try-drawer.vue';

defineOptions({ name: 'OpenPlatformClients' });
const allowed = computed(() => hasPermission('gateway:client:list'));
const canCreateClient = computed(() => hasPermission('gateway:client:create'));
const canUpdateClient = computed(() => hasPermission('gateway:client:update'));
const canGrantRoutes = computed(
  () =>
    hasPermission('gateway:client:grant') &&
    hasPermission('gateway:route:list'),
);
const canTryClient = computed(() => hasPermission('gateway:client:manage'));
const canReadCalls = computed(() => hasPermission('gateway:call:read'));
const rows = ref<GatewayClient[]>([]);
const users = ref<AdminUser[]>([]);
const gatewayInfo = ref<GatewayInfo>();
const recentCalls = ref<Record<number, string>>({});
const loading = ref(false);
const actionBusy = ref(false);
const error = ref('');
const lookupError = ref('');
const infoError = ref('');
const callError = ref('');
const formOpen = ref(false);
const editing = ref<GatewayClient>();
const selected = ref<GatewayClient>();
const secretsOpen = ref(false);
const grantsOpen = ref(false);
const tryOpen = ref(false);
const createdClient = ref<GatewayClient>();
const createdSecret = ref<GatewaySecretMaterial>();
const createdRemaining = ref(60);
let sequence = 0;
let stopCreatedTimer: (() => void) | undefined;

const columns = [
  { dataIndex: 'name', title: '名称', width: 200 },
  { dataIndex: 'app_id', title: 'AppID', width: 260 },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'last_call', title: '最近调用', width: 190 },
  { dataIndex: 'actions', title: '操作', width: 500 },
];

const exampleUrl = computed(() => {
  const base = gatewayInfo.value?.public_base_url.replace(/\/+$/, '');
  return base ? `${base}/open/v1/usage` : '';
});

function clearCreatedSecret() {
  stopCreatedTimer?.();
  stopCreatedTimer = undefined;
  createdClient.value = undefined;
  createdSecret.value = undefined;
  createdRemaining.value = 60;
}

function showCreated(result: GatewayClientCreated) {
  clearCreatedSecret();
  createdClient.value = result.client;
  createdSecret.value = result.key;
  stopCreatedTimer = startSecretCountdown((remaining) => {
    createdRemaining.value = remaining;
  }, clearCreatedSecret);
  void refresh();
}

async function loadAllUsers() {
  const result = await getUsersApi({ page: 1, page_size: 100 });
  const resultUsers = [...result.list];
  for (let page = 2; resultUsers.length < result.total; page++) {
    const next = await getUsersApi({ page, page_size: 100 });
    if (next.list.length === 0) break;
    resultUsers.push(...next.list);
  }
  return resultUsers;
}

async function loadRecentCalls(clients: GatewayClient[], current: number) {
  recentCalls.value = {};
  callError.value = '';
  if (!canReadCalls.value) return;
  const end = dayjs();
  const from = end.subtract(30, 'day').toISOString();
  const to = end.toISOString();
  for (let start = 0; start < clients.length; start += 8) {
    const batch = clients.slice(start, start + 8);
    const results = await Promise.allSettled(
      batch.map((client) =>
        getGatewayCallsApi({
          client_id: client.id,
          from,
          to,
          page: 1,
          page_size: 1,
        }),
      ),
    );
    if (current !== sequence) return;
    for (const [index, result] of results.entries()) {
      const client = batch[index];
      if (!client) continue;
      if (result.status === 'fulfilled' && result.value.list[0]) {
        recentCalls.value[client.id] = result.value.list[0].called_at;
      } else if (result.status === 'rejected') {
        callError.value = gatewayErrorMessage(result.reason);
      }
    }
  }
}

async function refresh() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  lookupError.value = '';
  infoError.value = '';
  const results = await Promise.allSettled([
    getGatewayClientsApi(),
    loadAllUsers(),
    getGatewayInfoApi(),
  ]);
  if (current !== sequence) return;
  if (results[0].status === 'fulfilled') rows.value = results[0].value;
  else {
    rows.value = [];
    error.value = gatewayErrorMessage(results[0].reason);
  }
  if (results[1].status === 'fulfilled') users.value = results[1].value;
  else {
    users.value = [];
    lookupError.value = gatewayErrorMessage(results[1].reason);
  }
  if (results[2].status === 'fulfilled') gatewayInfo.value = results[2].value;
  else {
    gatewayInfo.value = undefined;
    infoError.value = gatewayErrorMessage(results[2].reason);
  }
  if (results[0].status === 'fulfilled')
    await loadRecentCalls(results[0].value, current);
  if (current === sequence) loading.value = false;
}

function openEdit(client?: GatewayClient) {
  editing.value = client;
  formOpen.value = true;
}

function refreshAfterClientConflict() {
  void refresh();
}

function openSecrets(client: GatewayClient) {
  selected.value = client;
  secretsOpen.value = true;
}

function openGrants(client: GatewayClient) {
  selected.value = client;
  grantsOpen.value = true;
}

function openTry(client: GatewayClient) {
  selected.value = client;
  tryOpen.value = true;
}

async function toggleStatus(client: GatewayClient) {
  if (actionBusy.value) return;
  const status = client.status === 'active' ? 'suspended' : 'active';
  Modal.confirm({
    title: `${status === 'active' ? '启用' : '停用'}客户端？`,
    content: `确定${status === 'active' ? '启用' : '停用'}「${client.name}」？`,
    okText: status === 'active' ? '启用' : '停用',
    okType: status === 'active' ? 'primary' : 'danger',
    cancelText: '取消',
    async onOk() {
      actionBusy.value = true;
      try {
        await updateGatewayClientApi(client.id, {
          status,
          version: client.version,
        });
        message.success(status === 'active' ? '客户端已启用' : '客户端已停用');
        await refresh();
      } catch (error_) {
        error.value = gatewayErrorMessage(error_);
      } finally {
        actionBusy.value = false;
      }
    },
  });
}

async function copyCreatedSecret() {
  if (!createdSecret.value?.secret) return;
  try {
    await navigator.clipboard.writeText(createdSecret.value.secret);
    message.success('密钥已复制');
  } catch {
    message.error('复制失败，请手动选择密钥');
  }
}

onMounted(() => {
  if (allowed.value) void refresh();
});
onBeforeUnmount(() => {
  sequence++;
  clearCreatedSecret();
  rows.value = [];
  users.value = [];
  selected.value = undefined;
});
</script>

<template>
  <Forbidden v-if="!allowed" />
  <Page
    v-else
    title="API 客户端"
    description="管理开放平台客户端、密钥和路由授权。"
  >
    <Card data-testid="gateway-clients-page">
      <div class="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="canCreateClient"
            type="primary"
            :disabled="loading || !users.length"
            @click="openEdit()"
          >
            新建客户端
          </Button>
          <Button :disabled="loading" @click="refresh">刷新</Button>
        </div>
        <div v-if="exampleUrl" class="min-w-0 text-sm">
          <span class="mr-2 text-muted-foreground">调用示例</span>
          <Typography.Text copyable class="break-all font-mono">
            {{ exampleUrl }}
          </Typography.Text>
        </div>
      </div>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="refresh">重试</Button>
        </template>
      </Alert>
      <Alert
        v-if="lookupError"
        :message="`用户列表加载失败：${lookupError}`"
        type="warning"
        show-icon
        class="mb-4"
      >
        <template #action>
          <Button size="small" @click="refresh">重试</Button>
        </template>
      </Alert>
      <Alert
        v-if="infoError"
        :message="`网关信息加载失败：${infoError}`"
        type="warning"
        show-icon
        class="mb-4"
      >
        <template #action>
          <Button size="small" @click="refresh">重试</Button>
        </template>
      </Alert>
      <Alert
        v-if="callError"
        :message="`最近调用时间读取失败：${callError}`"
        type="warning"
        show-icon
        class="mb-4"
      />
      <Alert
        v-if="gatewayInfo?.allowed_origins.length"
        :message="`允许的来源：${gatewayInfo.allowed_origins.join('、')}`"
        type="info"
        show-icon
        class="mb-4"
      />
      <Table
        row-key="id"
        data-testid="gateway-client-list"
        :columns="columns"
        :data-source="rows"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1160 }"
      >
        <template #emptyText>
          <Empty v-if="!loading && !error" description="暂无 API 客户端">
            <Button
              v-if="canCreateClient"
              type="primary"
              :disabled="!users.length"
              @click="openEdit()"
            >
              新建客户端
            </Button>
          </Empty>
          <span v-else>{{
            error ? '客户端列表加载失败，请重试' : '正在加载'
          }}</span>
        </template>
        <template #bodyCell="{ column, record }">
          <template v-if="column.dataIndex === 'app_id'">
            <span class="font-mono">{{ record.app_id }}</span>
          </template>
          <template v-else-if="column.dataIndex === 'status'">
            <Tag :color="record.status === 'active' ? 'green' : 'default'">
              {{ record.status === 'active' ? '启用' : '停用' }}
            </Tag>
          </template>
          <template v-else-if="column.dataIndex === 'last_call'">
            <template v-if="canReadCalls">
              {{ formatDateTime(recentCalls[record.id]) }}
            </template>
            <span v-else>无查看权限</span>
          </template>
          <div
            v-else-if="column.dataIndex === 'actions'"
            class="flex flex-wrap gap-1"
          >
            <Button
              v-if="canUpdateClient"
              size="small"
              :disabled="actionBusy"
              @click="openEdit(record as GatewayClient)"
            >
              编辑
            </Button>
            <Button
              size="small"
              :disabled="actionBusy"
              @click="openSecrets(record as GatewayClient)"
            >
              密钥
            </Button>
            <Button
              v-if="canGrantRoutes"
              size="small"
              :disabled="actionBusy"
              @click="openGrants(record as GatewayClient)"
            >
              授权
            </Button>
            <Button
              v-if="canTryClient"
              size="small"
              :disabled="actionBusy"
              @click="openTry(record as GatewayClient)"
            >
              试调
            </Button>
            <Button
              v-if="canUpdateClient"
              size="small"
              :disabled="actionBusy"
              @click="toggleStatus(record as GatewayClient)"
            >
              {{ record.status === 'active' ? '停用' : '启用' }}
            </Button>
          </div>
        </template>
      </Table>
    </Card>
    <ClientFormDrawer
      :open="formOpen"
      :client="editing"
      :users="users"
      @close="
        formOpen = false;
        editing = undefined;
      "
      @saved="refresh"
      @created="showCreated"
      @refresh="refreshAfterClientConflict"
    />
    <SecretsDrawer
      :open="secretsOpen"
      :client="selected"
      @close="secretsOpen = false"
      @updated="refresh"
    />
    <GrantsDrawer
      v-if="canGrantRoutes"
      :open="grantsOpen"
      :client="selected"
      @close="grantsOpen = false"
      @saved="refresh"
    />
    <TryDrawer
      v-if="canTryClient"
      :open="tryOpen"
      :client="selected"
      @close="tryOpen = false"
    />
    <Modal
      :open="Boolean(createdSecret)"
      title="客户端已创建"
      :footer="null"
      :mask-closable="false"
      @cancel="clearCreatedSecret"
    >
      <Alert
        message="请记录 AppID 和首次密钥。密钥仅在此弹窗显示，60 秒后自动清除。"
        type="warning"
        show-icon
        class="mb-4"
      />
      <div class="mb-3">
        <div class="mb-1 text-xs text-muted-foreground">AppID</div>
        <Typography.Paragraph copyable class="break-all font-mono">
          {{ createdClient?.app_id }}
        </Typography.Paragraph>
      </div>
      <div>
        <div class="mb-1 text-xs text-muted-foreground">首次密钥</div>
        <pre class="break-all whitespace-pre-wrap rounded border p-3">{{
          createdSecret?.secret
        }}</pre>
      </div>
      <div class="mt-4 flex items-center justify-between">
        <span>剩余 {{ createdRemaining }} 秒</span>
        <div class="flex gap-2">
          <Button @click="copyCreatedSecret">复制密钥</Button>
          <Button type="primary" @click="clearCreatedSecret">
            已记录，关闭
          </Button>
        </div>
      </div>
    </Modal>
  </Page>
</template>
