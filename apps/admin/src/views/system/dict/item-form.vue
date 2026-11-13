<script setup lang="ts">
import type {
  Dictionary,
  DictionaryItem,
  DictionaryItemInput,
} from '#/api/model/configuration';

import { computed, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Space,
} from 'ant-design-vue';

import {
  createDictionaryItemApi,
  updateDictionaryItemApi,
} from '#/api/core/dictionaries';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';
import { useMetaDictionary } from '#/composables/use-meta-dictionary';

const props = defineProps<{ dictionary: Dictionary; item?: DictionaryItem }>();
const emit = defineEmits<{ busy: [value: boolean]; close: []; saved: [] }>();
const form = reactive<DictionaryItemInput>({
  label: props.item?.label ?? '',
  value: props.item?.value ?? '',
  sort: props.item?.sort ?? 0,
  status: props.item?.status ?? 'active',
  color: props.item?.color ?? '',
  extra: props.item?.extra ?? {},
});
const busy = ref(false);
const error = ref('');
const system = computed(() => props.dictionary.scope === 'system');
const allowed = computed(() =>
  hasPermission(props.item ? 'system:dict:update' : 'system:dict:create'),
);
const statuses = useMetaDictionary('user_status');
const options = computed(() =>
  statuses.options.value.filter(({ value }) =>
    ['active', 'disabled'].includes(value),
  ),
);
async function save() {
  if (busy.value || !allowed.value || (system.value && !props.item)) return;
  error.value = '';
  if (
    !form.label.trim() ||
    [...form.label].length > 256 ||
    !form.value.trim() ||
    [...form.value].length > 128
  ) {
    error.value = '标签须为 1–256 字符，值须为 1–128 字符';
    return;
  }
  if (
    !Number.isInteger(form.sort) ||
    form.sort < -2_147_483_648 ||
    form.sort > 2_147_483_647
  ) {
    error.value = '排序须为 -2147483648–2147483647 的整数';
    return;
  }
  const input: DictionaryItemInput = {
    ...form,
    value:
      props.item && (system.value || props.item.builtin)
        ? props.item.value
        : form.value,
    status: system.value && props.item ? props.item.status : form.status,
    color: system.value && props.item ? props.item.color : form.color,
    extra: props.item?.extra ?? {},
  };
  busy.value = true;
  emit('busy', true);
  try {
    await (props.item
      ? updateDictionaryItemApi(props.item.id, input)
      : createDictionaryItemApi(props.dictionary.id, input));
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
</script>

<template>
  <Modal
    :open="true"
    :title="item ? '编辑字典项' : '新增字典项'"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert
      v-if="system"
      message="系统字典仅允许修改标签和排序"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item label="标签" required>
        <Input
          v-model:value="form.label"
          aria-label="字典项标签"
          :maxlength="256"
        />
      </Form.Item>
      <Form.Item
        label="值"
        :help="
          system || item?.builtin
            ? '内置值不可修改'
            : '同一字典内唯一，最多 128 字符'
        "
        required
      >
        <Input
          v-model:value="form.value"
          aria-label="字典项值"
          :disabled="system || item?.builtin"
          :maxlength="128"
        />
      </Form.Item>
      <Form.Item label="排序">
        <InputNumber
          v-model:value="form.sort"
          aria-label="字典项排序"
          :precision="0"
          :min="-2_147_483_648"
          :max="2_147_483_647"
        />
      </Form.Item>
      <Form.Item label="状态">
        <Select
          v-model:value="form.status"
          aria-label="字典项状态"
          :disabled="system"
          :options="options"
        />
      </Form.Item>
      <Form.Item label="颜色" help="可选，例如 green、blue 或 #1677ff">
        <Input
          v-model:value="form.color"
          aria-label="字典项颜色"
          :disabled="system"
          :maxlength="64"
        />
      </Form.Item>
      <Space>
        <Button
          v-if="allowed"
          type="primary"
          html-type="submit"
          :loading="busy"
        >
          保存字典项
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
