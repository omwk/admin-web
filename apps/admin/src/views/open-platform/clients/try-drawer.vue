<script setup lang="ts">
import type {
  GatewayClient,
  GatewayRouteGrant,
  GatewayTryResult,
} from '#/api/model/gateway';

import { computed, onBeforeUnmount, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Input,
  Select,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  getGatewayClientApi,
  getGatewayClientGrantsApi,
  tryGatewayClientApi,
} from '#/api/core/gateway';

import { gatewayErrorMessage } from '../shared/gateway-error';
import { activeGatewayGrants, parseTryQuery, tryBody } from './options';

const props = defineProps<{ client?: GatewayClient; open: boolean }>();
const emit = defineEmits<{ close: [] }>();
const clientInfo = ref<GatewayClient>();
const grants = ref<GatewayRouteGrant[]>([]);
const routeId = ref<number>();
const queryText = ref('');
const bodyText = ref('');
const loading = ref(false);
const sending = ref(false);
const error = ref('');
const result = ref<GatewayTryResult>();
let sequence = 0;

const selectableGrants = computed(() => activeGatewayGrants(grants.value));
const responseText = computed(() => {
  if (result.value?.response === undefined) return '';
  if (typeof result.value.response === 'string') return result.value.response;
  return JSON.stringify(result.value.response, null, 2) ?? 'null';
});

async function load() {
  const client = props.client;
  if (!client) return;
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const [clientResult, grantResult] = await Promise.all([
      getGatewayClientApi(client.id),
      getGatewayClientGrantsApi(client.id),
    ]);
    if (current !== sequence) return;
    clientInfo.value = clientResult;
    grants.value = grantResult;
    routeId.value = activeGatewayGrants(grantResult)[0]?.route_id;
  } catch (error_) {
    if (current === sequence) {
      clientInfo.value = undefined;
      grants.value = [];
      routeId.value = undefined;
      error.value = gatewayErrorMessage(error_);
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}

async function send() {
  const client = props.client;
  const selectedRouteId = routeId.value;
  if (!client || selectedRouteId === undefined || sending.value) return;
  error.value = '';
  result.value = undefined;
  let query: Record<string, string>;
  let body: unknown;
  try {
    query = parseTryQuery(queryText.value);
    body = tryBody(bodyText.value);
  } catch (error_) {
    error.value =
      error_ instanceof Error ? error_.message : '试调参数格式不正确';
    return;
  }
  sending.value = true;
  try {
    result.value = await tryGatewayClientApi(client.id, {
      ...(body === undefined ? {} : { body }),
      ...(Object.keys(query).length === 0 ? {} : { query }),
      route_id: selectedRouteId,
    });
  } catch (error_) {
    error.value = gatewayErrorMessage(error_);
  } finally {
    sending.value = false;
  }
}

function close() {
  sequence++;
  clientInfo.value = undefined;
  grants.value = [];
  routeId.value = undefined;
  queryText.value = '';
  bodyText.value = '';
  result.value = undefined;
  error.value = '';
  emit('close');
}

watch(
  () => [props.open, props.client?.id] as const,
  ([open]) => {
    sequence++;
    clientInfo.value = undefined;
    grants.value = [];
    routeId.value = undefined;
    queryText.value = '';
    bodyText.value = '';
    result.value = undefined;
    error.value = '';
    if (open) void load();
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  sequence++;
  clientInfo.value = undefined;
  grants.value = [];
  queryText.value = '';
  bodyText.value = '';
  result.value = undefined;
});
</script>

<template>
  <Drawer
    :open="open"
    :title="clientInfo ? `试调 · ${clientInfo.name}` : '试调'"
    :width="760"
    :mask-closable="false"
    @close="close"
  >
    <Alert
      message="测试调用：不计费，但会记录日志。请求体与响应体只在当前页面临时显示。"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4">
      <template #action>
        <Button size="small" :disabled="loading || sending" @click="load">
          重试
        </Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <div v-if="selectableGrants.length" class="space-y-4">
        <div>
          <label for="gateway-try-route" class="mb-1 block">路由</label>
          <Select
            id="gateway-try-route"
            v-model:value="routeId"
            aria-label="试调路由"
            class="w-full"
            :options="
              selectableGrants.map((grant: GatewayRouteGrant) => ({
                label: `${grant.method} ${grant.path || grant.route_code} · ${grant.route_name || grant.route_code}`,
                value: grant.route_id,
              }))
            "
            :disabled="sending"
          />
        </div>
        <div>
          <label for="gateway-try-query" class="mb-1 block">Query</label>
          <Input.TextArea
            id="gateway-try-query"
            v-model:value="queryText"
            aria-label="试调 Query 参数"
            :rows="4"
            :disabled="sending"
            placeholder="每行一个 key=value"
          />
        </div>
        <div>
          <label for="gateway-try-body" class="mb-1 block">Body JSON</label>
          <Input.TextArea
            id="gateway-try-body"
            v-model:value="bodyText"
            aria-label="试调 Body JSON"
            :rows="8"
            :disabled="sending"
            class="font-mono"
            placeholder="可留空"
          />
        </div>
        <Button
          type="primary"
          :loading="sending"
          :disabled="routeId === undefined"
          @click="send"
        >
          发送试调
        </Button>
      </div>
      <Empty
        v-else-if="!loading && !error"
        description="该客户端没有当前有效的路由授权"
      />
    </Spin>
    <section
      v-if="result"
      class="mt-6 border-t pt-4"
      aria-label="试调结果"
      data-testid="gateway-try-result"
    >
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <strong>结果</strong>
        <Tag :color="result.status_code >= 400 ? 'red' : 'green'">
          {{ result.status_code }}
        </Tag>
        <span>{{ result.latency_ms }} ms</span>
        <span>
          计费模式
          {{ result.billing.mode === 'per_call' ? '按量计费' : '免费' }}
        </span>
        <span>{{ result.billing.units }} 单位</span>
        <Tag>{{ result.billing.billed ? '已计费' : '不计费' }}</Tag>
        <span v-if="result.error_code">错误码 {{ result.error_code }}</span>
      </div>
      <Alert
        v-if="result.truncated"
        message="响应体过长，已由服务端截断。"
        type="warning"
        show-icon
        class="mb-3"
      />
      <pre
        class="max-h-96 overflow-auto whitespace-pre-wrap break-all rounded border p-3"
        >{{ responseText }}</pre>
    </section>
  </Drawer>
</template>
