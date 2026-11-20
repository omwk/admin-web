<script setup lang="ts">
import type { StorageInput, StorageProvider } from '#/api/model/storage';

import { computed, onUnmounted, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Modal,
  Switch,
  Tooltip,
} from 'ant-design-vue';

import {
  saveStorageProviderApi,
  testStorageProviderApi,
} from '#/api/core/storage';
import { toApiError } from '#/api/errors';

import {
  connectionResult,
  emptyProvider,
  normalizeProvider,
  validateProvider,
} from './options';

const props = defineProps<{ open: boolean; provider?: StorageProvider }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const draft = ref<StorageInput>(emptyProvider());
const visible = ref(true);
const busy = ref(false);
const error = ref('');
const errors = ref<Record<string, string>>({});
const result = ref<ReturnType<typeof connectionResult>>();
const unchanged = computed(
  () =>
    props.provider &&
    JSON.stringify(draft.value) === JSON.stringify(props.provider),
);
watch(
  () => props.open,
  (open) => {
    draft.value =
      open && props.provider ? { ...props.provider } : emptyProvider();
    visible.value = true;
    error.value = '';
    errors.value = {};
    result.value = undefined;
  },
);
onUnmounted(() => {
  draft.value = emptyProvider();
});
async function save() {
  if (busy.value) return;
  errors.value = validateProvider(draft.value);
  if (Object.keys(errors.value).length > 0) return;
  busy.value = true;
  error.value = '';
  try {
    await saveStorageProviderApi(
      normalizeProvider(draft.value),
      props.provider?.id,
    );
    message.success('已保存，立即生效');
    emit('saved');
    emit('close');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
async function test() {
  if (!props.provider || !unchanged.value || busy.value) return;
  busy.value = true;
  result.value = undefined;
  error.value = '';
  try {
    const tested = await testStorageProviderApi(props.provider.id);
    result.value = connectionResult(tested.status);
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
async function copy() {
  try {
    await navigator.clipboard.writeText(draft.value.secret_key);
    message.success('Secret Key 已复制');
  } catch {
    message.error('复制失败，请选择密钥手动复制');
  }
}
const fields = [
  { key: 'name', label: '名称', max: 128 },
  { key: 'endpoint', label: '服务地址', max: 512 },
  { key: 'bucket', label: '桶名', max: 63 },
  { key: 'region', label: 'Region', max: 128 },
  { key: 'access_key', label: 'Access Key', max: 256 },
  { key: 'secret_key', label: 'Secret Key', max: 4096 },
  { key: 'public_base_url', label: '公开访问前缀（可选）', max: 2048 },
] as const;
</script>

<template>
  <Modal
    :open="open"
    :title="provider ? '编辑存储配置' : '新建存储配置'"
    :width="640"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Alert
      v-if="result"
      :message="result.text"
      :type="result.type"
      show-icon
      class="mb-4"
    />
    <Form layout="vertical" :disabled="busy" autocomplete="off" @finish="save">
      <Form.Item
        v-for="field in fields"
        :key="field.key"
        :label="field.label"
        :validate-status="errors[field.key] ? 'error' : undefined"
        :help="errors[field.key]"
      >
        <div v-if="field.key === 'secret_key'" class="flex items-center gap-2">
          <Input
            v-model:value="draft.secret_key"
            aria-label="Secret Key"
            :type="visible ? 'text' : 'password'"
            autocomplete="new-password"
            :maxlength="field.max"
          />
          <Button
            :aria-label="visible ? '隐藏 Secret Key' : '显示 Secret Key'"
            @click="visible = !visible"
          >
            {{ visible ? '隐藏' : '显示' }}
          </Button>
          <Button
            :disabled="!draft.secret_key"
            aria-label="复制 Secret Key"
            @click="copy"
          >
            复制
          </Button>
        </div>
        <Input
          v-else
          v-model:value="draft[field.key]"
          :aria-label="field.label"
          :maxlength="field.max"
        />
        <div
          v-if="field.key === 'endpoint'"
          class="mt-1 text-xs text-muted-foreground"
        >
          不要带 https://，也可填
          https://host:port；完整地址中的协议和端口优先。
        </div>
      </Form.Item>
      <div class="flex flex-wrap gap-6">
        <Form.Item
          label="端口"
          :validate-status="errors.port ? 'error' : undefined"
          :help="errors.port"
        >
          <InputNumber
            v-model:value="draft.port"
            aria-label="端口"
            :min="1"
            :max="65535"
            :precision="0"
          />
        </Form.Item>
        <Form.Item label="使用 HTTPS">
          <Switch v-model:checked="draft.use_ssl" aria-label="使用 HTTPS" />
        </Form.Item>
        <Form.Item label="路径风格访问">
          <Switch
            v-model:checked="draft.path_style"
            aria-label="路径风格访问"
          />
        </Form.Item>
        <Form.Item label="启用">
          <Switch
            v-model:checked="draft.enabled"
            aria-label="启用"
            :disabled="draft.is_default"
          />
        </Form.Item>
      </div>
    </Form>
    <template #footer>
      <div class="flex flex-wrap items-center justify-between gap-2">
        <Tooltip :title="unchanged ? '' : '请先保存配置后测试连接'">
          <span>
            <Button
              :disabled="!unchanged || busy"
              :loading="busy"
              @click="test"
            >
              测试连接
            </Button>
          </span>
        </Tooltip>
        <span v-if="!unchanged" class="text-xs text-muted-foreground">
          请先保存配置后测试连接
        </span>
        <div class="flex gap-2">
          <Button :disabled="busy" @click="emit('close')">取消</Button>
          <Button type="primary" :loading="busy" @click="save">保存</Button>
        </div>
      </div>
    </template>
  </Modal>
</template>
