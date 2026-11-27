<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type {
  GatewayClient,
  GatewayRoute,
  GatewayRouteGrant,
} from '#/api/model/gateway';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Checkbox,
  DatePicker,
  Drawer,
  Empty,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  getGatewayClientApi,
  getGatewayClientGrantsApi,
  getGatewayRoutesApi,
  revokeGatewayClientGrantApi,
  saveGatewayClientGrantApi,
} from '#/api/core/gateway';
import { formatDateTime } from '#/utils/datetime';

import { gatewayErrorMessage } from '../shared/gateway-error';

interface GrantDraft {
  expires_at: null | string;
  quota_daily: number;
  quota_monthly: number;
  selected: boolean;
  status: 'active' | 'suspended';
}

interface GrantRow {
  grant?: GatewayRouteGrant;
  method: string;
  path: string;
  route_code: string;
  route_id: number;
  route_name: string;
  selectable: boolean;
}

const props = defineProps<{ client?: GatewayClient; open: boolean }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const clientInfo = ref<GatewayClient>();
const routes = ref<GatewayRoute[]>([]);
const grants = ref<GatewayRouteGrant[]>([]);
const drafts = ref(new Map<number, GrantDraft>());
const loading = ref(false);
const busy = ref(false);
const error = ref('');
let sequence = 0;

const rows = computed<GrantRow[]>(() => {
  const rowsById = new Map<number, GrantRow>();
  for (const route of routes.value) {
    if (route.visibility !== 'public') continue;
    rowsById.set(route.id, {
      method: route.method,
      path: route.path,
      route_code: route.code,
      route_id: route.id,
      route_name: route.name,
      selectable: true,
    });
  }
  for (const grant of grants.value) {
    const row = rowsById.get(grant.route_id);
    if (row) {
      row.grant = grant;
    } else {
      rowsById.set(grant.route_id, {
        grant,
        method: grant.method,
        path: grant.path,
        route_code: grant.route_code,
        route_id: grant.route_id,
        route_name: grant.route_name,
        selectable: false,
      });
    }
  }
  return [...rowsById.values()].toSorted((a, b) =>
    a.route_code.localeCompare(b.route_code),
  );
});

const columns = [
  { dataIndex: 'selected', title: '授权', width: 80 },
  { dataIndex: 'route', title: '路由', width: 280 },
  { dataIndex: 'status', title: '状态', width: 140 },
  { dataIndex: 'quota_daily', title: '每日配额', width: 140 },
  { dataIndex: 'quota_monthly', title: '每月配额', width: 140 },
  { dataIndex: 'expires_at', title: '过期时间', width: 220 },
  { dataIndex: 'actions', title: '操作', width: 100 },
];

function draftFor(row: GrantRow) {
  return (
    drafts.value.get(row.route_id) ??
    ({
      expires_at: row.grant?.expires_at ?? null,
      quota_daily: row.grant?.quota_daily ?? 0,
      quota_monthly: row.grant?.quota_monthly ?? 0,
      selected: Boolean(row.grant),
      status: row.grant?.status ?? 'active',
    } satisfies GrantDraft)
  );
}

function updateDraft(routeId: number, update: Partial<GrantDraft>) {
  const next = new Map(drafts.value);
  const current = next.get(routeId);
  if (!current) return;
  next.set(routeId, { ...current, ...update });
  drafts.value = next;
}

async function load() {
  const client = props.client;
  if (!client) return;
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const [clientResult, grantResult, routeResult] = await Promise.all([
      getGatewayClientApi(client.id),
      getGatewayClientGrantsApi(client.id),
      getGatewayRoutesApi(),
    ]);
    if (current !== sequence) return;
    clientInfo.value = clientResult;
    grants.value = grantResult;
    routes.value = routeResult;
    drafts.value = new Map(
      grantResult.map((grant) => [
        grant.route_id,
        {
          expires_at: grant.expires_at,
          quota_daily: grant.quota_daily,
          quota_monthly: grant.quota_monthly,
          selected: true,
          status: grant.status,
        },
      ]),
    );
    for (const route of routeResult) {
      if (route.visibility === 'public' && !drafts.value.has(route.id)) {
        const next = new Map(drafts.value);
        next.set(route.id, {
          expires_at: null,
          quota_daily: 0,
          quota_monthly: 0,
          selected: false,
          status: 'active',
        });
        drafts.value = next;
      }
    }
  } catch (error_) {
    if (current === sequence) {
      clientInfo.value = undefined;
      grants.value = [];
      routes.value = [];
      drafts.value = new Map();
      error.value = gatewayErrorMessage(error_);
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

function setExpiry(routeId: number, value: Dayjs | null | string | undefined) {
  updateDraft(routeId, {
    expires_at: value ? dayjs(value).toISOString() : null,
  });
}

function validate() {
  for (const row of rows.value) {
    const draft = draftFor(row);
    if (
      !Number.isSafeInteger(draft.quota_daily) ||
      draft.quota_daily < 0 ||
      !Number.isSafeInteger(draft.quota_monthly) ||
      draft.quota_monthly < 0
    )
      return `${row.route_code} 的配额必须是大于或等于 0 的整数`;
    if (!row.grant && draft.selected && !row.selectable)
      return `${row.route_code} 的路由已不可授权`;
  }
  return '';
}

async function save() {
  const client = props.client;
  if (!client || busy.value || loading.value) return;
  error.value = validate();
  if (error.value) return;
  busy.value = true;
  try {
    for (const row of rows.value) {
      const draft = draftFor(row);
      if (draft.selected && row.selectable) {
        await saveGatewayClientGrantApi(client.id, {
          expires_at: draft.expires_at,
          quota_daily: draft.quota_daily,
          quota_monthly: draft.quota_monthly,
          route_id: row.route_id,
          status: draft.status,
        });
      } else if (row.grant) {
        await revokeGatewayClientGrantApi(client.id, row.grant.id);
      }
    }
    await load();
    emit('saved');
    message.success('路由授权已保存');
  } catch (error_) {
    const saveError = gatewayErrorMessage(error_);
    await load();
    error.value = error.value
      ? `${saveError}；刷新授权失败：${error.value}`
      : saveError;
  } finally {
    busy.value = false;
  }
}

function revoke(row: GrantRow) {
  const client = props.client;
  const grantId = row.grant?.id;
  if (!client || !grantId || busy.value) return;
  Modal.confirm({
    title: '撤销路由授权？',
    content: `确定撤销 ${row.route_code}？撤销后此客户端将不能调用该路由。`,
    okType: 'danger',
    okText: '撤销',
    cancelText: '取消',
    async onOk() {
      busy.value = true;
      error.value = '';
      try {
        await revokeGatewayClientGrantApi(client.id, grantId);
        grants.value = grants.value.filter((grant) => grant.id !== grantId);
        const nextDrafts = new Map(drafts.value);
        nextDrafts.delete(row.route_id);
        drafts.value = nextDrafts;
        await load();
        emit('saved');
        message.success('路由授权已撤销');
      } catch (error_) {
        const revokeError = gatewayErrorMessage(error_);
        await load();
        error.value = error.value
          ? `${revokeError}；刷新授权失败：${error.value}`
          : revokeError;
        throw error_;
      } finally {
        busy.value = false;
      }
    },
  });
}

function close() {
  sequence++;
  clientInfo.value = undefined;
  routes.value = [];
  grants.value = [];
  drafts.value = new Map();
  error.value = '';
  emit('close');
}

watch(
  () => [props.open, props.client?.id] as const,
  ([open]) => {
    sequence++;
    clientInfo.value = undefined;
    routes.value = [];
    grants.value = [];
    drafts.value = new Map();
    error.value = '';
    if (open) void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  sequence++;
  drafts.value = new Map();
});
</script>

<template>
  <Drawer
    :open="open"
    :title="clientInfo ? `路由授权 · ${clientInfo.name}` : '路由授权'"
    :width="1080"
    :closable="!busy"
    :mask-closable="false"
    @close="close"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4">
      <template #action>
        <Button size="small" :disabled="busy" @click="load">重试</Button>
      </template>
    </Alert>
    <Alert
      message="配额 0 表示不限。未选中的已有授权将在保存时撤销。"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert
      v-if="rows.some((row) => !row.selectable && row.grant)"
      message="已删除的路由仅可查看或撤销，不能修改授权配置。"
      type="warning"
      show-icon
      class="mb-4"
    />
    <Table
      row-key="route_id"
      data-testid="gateway-client-grants"
      :columns="columns"
      :data-source="rows"
      :loading="loading"
      :pagination="false"
      :scroll="{ x: 1120 }"
    >
      <template #emptyText>
        <Empty v-if="!loading && !error" description="暂无 public 路由或授权" />
        <span v-else>{{
          error ? '授权信息加载失败，请重试' : '正在加载'
        }}</span>
      </template>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'selected'">
          <Checkbox
            :checked="draftFor(record as GrantRow).selected"
            :aria-label="`授权 ${record.route_code}`"
            :disabled="busy || loading || (!record.selectable && !record.grant)"
            @change="
              updateDraft(record.route_id, {
                selected: $event.target.checked,
              })
            "
          />
        </template>
        <div v-else-if="column.dataIndex === 'route'">
          <div>{{ record.route_name || '路由已删除' }}</div>
          <code>{{ record.route_code }}</code>
          <div class="text-xs text-muted-foreground">
            {{ record.method }} {{ record.path }}
          </div>
        </div>
        <Select
          v-else-if="column.dataIndex === 'status'"
          :value="draftFor(record as GrantRow).status"
          :aria-label="`${record.route_code} 授权状态`"
          :options="[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'suspended' },
          ]"
          :disabled="
            busy ||
            loading ||
            !record.selectable ||
            !draftFor(record as GrantRow).selected
          "
          @change="
            updateDraft(record.route_id, {
              status: $event as 'active' | 'suspended',
            })
          "
        />
        <InputNumber
          v-else-if="column.dataIndex === 'quota_daily'"
          :value="draftFor(record as GrantRow).quota_daily"
          :aria-label="`${record.route_code} 每日配额`"
          :min="0"
          :max="2_147_483_647"
          :precision="0"
          :disabled="
            busy ||
            loading ||
            !record.selectable ||
            !draftFor(record as GrantRow).selected
          "
          @change="
            updateDraft(record.route_id, {
              quota_daily: Number($event ?? 0),
            })
          "
        />
        <InputNumber
          v-else-if="column.dataIndex === 'quota_monthly'"
          :value="draftFor(record as GrantRow).quota_monthly"
          :aria-label="`${record.route_code} 每月配额`"
          :min="0"
          :max="2_147_483_647"
          :precision="0"
          :disabled="
            busy ||
            loading ||
            !record.selectable ||
            !draftFor(record as GrantRow).selected
          "
          @change="
            updateDraft(record.route_id, {
              quota_monthly: Number($event ?? 0),
            })
          "
        />
        <div v-else-if="column.dataIndex === 'expires_at'">
          <DatePicker
            :value="
              draftFor(record as GrantRow).expires_at
                ? dayjs(draftFor(record as GrantRow).expires_at)
                : undefined
            "
            :aria-label="`${record.route_code} 过期时间`"
            show-time
            allow-clear
            :disabled="
              busy ||
              loading ||
              !record.selectable ||
              !draftFor(record as GrantRow).selected
            "
            @change="setExpiry(record.route_id, $event)"
          />
          <div class="mt-1 text-xs text-muted-foreground">
            {{ formatDateTime(draftFor(record as GrantRow).expires_at) }}
          </div>
        </div>
        <Button
          v-else-if="column.dataIndex === 'actions' && record.grant"
          size="small"
          danger
          :disabled="busy || loading"
          @click="revoke(record as GrantRow)"
        >
          撤销
        </Button>
      </template>
    </Table>
    <template #footer>
      <div class="flex justify-end gap-2">
        <Button :disabled="busy" @click="close">关闭</Button>
        <Button
          type="primary"
          :loading="busy"
          :disabled="loading || !clientInfo"
          @click="save"
        >
          保存授权
        </Button>
      </div>
    </template>
  </Drawer>
</template>
