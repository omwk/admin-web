<script setup lang="ts">
import type {
  NotificationKind,
  NotificationProvider,
} from '#/api/model/notification';

import { computed, onUnmounted, reactive, ref } from 'vue';

import {
  Alert,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
} from 'ant-design-vue';

import { saveNotificationProviderApi } from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import { providerFields, providerKinds } from './provider-fields';

const props = defineProps<{ provider?: NotificationProvider }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const kind = ref<NotificationKind>(props.provider?.kind ?? 'smtp');
const config = ref<Record<string, string>>({});
const form = reactive({
  name: props.provider?.name ?? '',
  enabled: props.provider?.enabled ?? true,
  priority: props.provider?.priority ?? 0,
});
const fields = computed(() => providerFields(kind.value));
const busy = ref(false);
const error = ref('');
function configured(key: string) {
  return props.provider?.config[`${key}_configured`] === true;
}
function resetConfig() {
  config.value = {};
  for (const field of fields.value) {
    const value = props.provider?.config[field.key];
    config.value[field.key] =
      !field.private && typeof value === 'string' ? value : '';
  }
  if (kind.value === 'smtp' && !config.value.tls_mode)
    config.value.tls_mode = 'starttls';
}
resetConfig();
async function save() {
  if (busy.value) return;
  error.value = '';
  if (
    !form.name.trim() ||
    fields.value.some(
      (field) =>
        field.required &&
        !config.value[field.key]?.trim() &&
        !configured(field.key),
    )
  ) {
    error.value = '请填写服务商名称及必填配置；编辑时留空保留已配置值';
    return;
  }
  const selected = providerKinds.find((value) => value.value === kind.value);
  if (!selected) return;
  busy.value = true;
  const privateValues = fields.value
    .filter((field) => field.private)
    .map((field) => config.value[field.key] ?? '');
  try {
    await saveNotificationProviderApi(
      {
        ...form,
        name: form.name.trim(),
        kind: kind.value,
        channel: selected.channel,
        config: Object.fromEntries(
          Object.entries(config.value).filter(([, value]) => value.length > 0),
        ),
      },
      props.provider?.id,
    );
    config.value = {};
    emit('saved');
  } catch (error_) {
    error.value = notificationError(error_, privateValues);
  } finally {
    busy.value = false;
  }
}
onUnmounted(() => {
  config.value = {};
});
</script>

<template>
  <Modal
    open
    :title="provider ? '编辑服务商' : '新增服务商'"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <div data-testid="notification-provider-form">
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <Alert
        type="info"
        message="密钥保存后仅显示「已配置」。编辑时留空保留原配置。"
        show-icon
        class="mb-4"
      />
      <Form layout="vertical" :disabled="busy" autocomplete="off">
        <Form.Item label="类型" required>
          <Select
            v-model:value="kind"
            aria-label="服务商类型"
            :disabled="!!provider"
            :options="providerKinds"
            @change="resetConfig"
          />
        </Form.Item>
        <Form.Item label="名称" required>
          <Input
            v-model:value="form.name"
            aria-label="服务商名称"
            :maxlength="100"
          />
        </Form.Item>
        <Form.Item
          v-for="field in fields"
          :key="field.key"
          :label="field.label"
          :required="field.required"
        >
          <Select
            v-if="field.key === 'tls_mode'"
            v-model:value="config[field.key]"
            :aria-label="field.label"
            :options="[
              { label: 'STARTTLS', value: 'starttls' },
              { label: 'TLS', value: 'tls' },
              { label: '本机明文（仅回环地址）', value: 'plain' },
            ]"
          />
          <Input.Password
            v-else-if="field.private"
            v-model:value="config[field.key]"
            :aria-label="field.label"
            :placeholder="configured(field.key) ? '已配置' : '请输入'"
            :visibility-toggle="false"
            autocomplete="new-password"
            :maxlength="4096"
          />
          <Input
            v-else
            v-model:value="config[field.key]"
            :aria-label="field.label"
            :maxlength="4096"
          />
          <div v-if="configured(field.key)" class="text-xs text-gray-500">
            已配置
          </div>
        </Form.Item>
        <Form.Item label="优先级">
          <InputNumber
            v-model:value="form.priority"
            aria-label="服务商优先级"
            :precision="0"
          />
        </Form.Item>
        <Form.Item label="启用">
          <Switch v-model:checked="form.enabled" aria-label="启用服务商" />
        </Form.Item>
      </Form>
    </div>
  </Modal>
</template>
