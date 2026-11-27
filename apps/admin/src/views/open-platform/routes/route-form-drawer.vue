<script setup lang="ts">
import type { GatewayRouteDraft } from './options';

import type { GatewayRoute } from '#/api/model/gateway';

import { reactive, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  Form,
  Input,
  InputNumber,
  Select,
} from 'ant-design-vue';

import {
  createGatewayRouteApi,
  updateGatewayRouteApi,
} from '#/api/core/gateway';

import {
  gatewayRouteSaveError,
  isGatewayVersionConflict,
} from '../shared/gateway-error';
import {
  applyGatewayCapability,
  emptyGatewayRouteDraft,
  gatewayCapabilities,
  normalizeGatewayRoute,
  validateGatewayRoute,
} from './options';

const props = defineProps<{ open: boolean; route?: GatewayRoute }>();
const emit = defineEmits<{ close: []; conflict: []; saved: [] }>();
function emptyDraft(): GatewayRouteDraft {
  return emptyGatewayRouteDraft();
}
const draft = reactive<GatewayRouteDraft>(emptyDraft());
const busy = ref(false);
const error = ref('');
function selectCapability(value: unknown) {
  if (typeof value === 'string') applyGatewayCapability(draft, value);
}

watch(
  () => [props.open, props.route] as const,
  ([open, route]) => {
    if (!open) return;
    Object.assign(draft, route ? { ...route } : emptyDraft());
    error.value = '';
  },
  { immediate: true },
);

async function save() {
  error.value = validateGatewayRoute(draft);
  if (error.value || busy.value) return;
  busy.value = true;
  try {
    const input = normalizeGatewayRoute(draft);
    await (props.route
      ? updateGatewayRouteApi(props.route.id, {
          ...input,
          version: props.route.version,
        })
      : createGatewayRouteApi(input));
    emit('saved');
    emit('close');
  } catch (error_) {
    error.value = gatewayRouteSaveError(error_);
    if (isGatewayVersionConflict(error_)) emit('conflict');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Drawer
    :open="open"
    :title="route ? '编辑路由' : '新建路由'"
    :width="640"
    :closable="!busy"
    :mask-closable="false"
    @close="emit('close')"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4" />
    <Form layout="vertical" :disabled="busy" autocomplete="off">
      <Form.Item label="Code" required>
        <Input
          v-model:value="draft.code"
          aria-label="路由 code"
          :maxlength="128"
          disabled
        />
      </Form.Item>
      <Form.Item label="名称" required>
        <Input
          v-model:value="draft.name"
          aria-label="路由名称"
          :maxlength="100"
        />
      </Form.Item>
      <Form.Item label="Capability" required>
        <Select
          v-model:value="draft.capability"
          aria-label="Capability"
          :disabled="Boolean(route)"
          :options="
            gatewayCapabilities.map(({ capability, label }) => ({
              label: `${label} (${capability})`,
              value: capability,
            }))
          "
          @change="selectCapability"
        />
      </Form.Item>
      <div class="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Form.Item label="方法" required>
          <Select
            v-model:value="draft.method"
            aria-label="HTTP 方法"
            :disabled="Boolean(route)"
            :options="['GET', 'HEAD'].map((value) => ({ label: value, value }))"
          />
        </Form.Item>
        <Form.Item label="路径" required>
          <Input
            v-model:value="draft.path"
            aria-label="路由路径"
            :disabled="Boolean(route)"
          />
        </Form.Item>
        <Form.Item label="路由分组" required>
          <Input
            v-model:value="draft.route_group"
            aria-label="路由分组"
            :maxlength="100"
            :disabled="Boolean(route)"
          />
        </Form.Item>
        <Form.Item label="可见性" required>
          <Select
            v-model:value="draft.visibility"
            aria-label="路由可见性"
            :options="[
              { label: 'Public', value: 'public' },
              { label: 'Private', value: 'private' },
            ]"
            :disabled="Boolean(route)"
          />
        </Form.Item>
        <Form.Item label="计费模式" required>
          <Select
            v-model:value="draft.billing_mode"
            aria-label="计费模式"
            :options="[
              { label: '免费', value: 'free' },
              { label: '按量计费', value: 'per_call' },
            ]"
          />
        </Form.Item>
        <Form.Item label="状态" required>
          <Select
            v-model:value="draft.status"
            aria-label="路由状态"
            :options="[
              { label: '启用', value: 'enabled' },
              { label: '停用', value: 'disabled' },
            ]"
          />
        </Form.Item>
      </div>
      <div
        v-if="draft.billing_mode === 'per_call'"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2"
      >
        <Form.Item label="价格（分/次）" required>
          <InputNumber
            :value="draft.price_cents ?? undefined"
            aria-label="价格（分每次）"
            :min="1"
            :max="Number.MAX_SAFE_INTEGER"
            :precision="0"
            class="w-full"
            @change="
              (value) =>
                (draft.price_cents = typeof value === 'number' ? value : null)
            "
          />
        </Form.Item>
        <Form.Item label="每次用量" required>
          <InputNumber
            :value="draft.units_per_call ?? undefined"
            aria-label="每次用量"
            :min="1"
            :max="Number.MAX_SAFE_INTEGER"
            :precision="0"
            class="w-full"
            @change="
              (value) =>
                (draft.units_per_call =
                  typeof value === 'number' ? value : null)
            "
          />
        </Form.Item>
        <Form.Item label="币种" required>
          <Input
            v-model:value="draft.currency"
            aria-label="币种"
            :maxlength="3"
          />
        </Form.Item>
      </div>
      <Form.Item v-else label="币种" required>
        <Input
          v-model:value="draft.currency"
          aria-label="币种"
          :maxlength="3"
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
