<script setup lang="ts">
import type { Dictionary, DictionaryInput } from '#/api/model/configuration';

import { computed, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
} from 'ant-design-vue';

import {
  createDictionaryApi,
  updateDictionaryApi,
} from '#/api/core/dictionaries';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';
import { useMetaDictionary } from '#/composables/use-meta-dictionary';

const props = defineProps<{ dictionary?: Dictionary }>();
const emit = defineEmits<{
  busy: [value: boolean];
  close: [];
  saved: [dictionary: Dictionary];
}>();
const form = reactive<DictionaryInput>({
  name: props.dictionary?.name ?? '',
  type: props.dictionary?.type ?? '',
  status: props.dictionary?.status ?? 'active',
});
const busy = ref(false);
const error = ref('');
const statuses = useMetaDictionary('user_status');
const options = computed(() =>
  statuses.options.value.filter(({ value }) =>
    ['active', 'disabled'].includes(value),
  ),
);
const allowed = computed(() =>
  hasPermission(props.dictionary ? 'system:dict:update' : 'system:dict:create'),
);
async function save() {
  if (busy.value || !allowed.value || props.dictionary?.scope === 'system')
    return;
  error.value = '';
  if (
    !/^[a-z][a-z0-9_]{0,63}$/.test(form.type) ||
    !form.name.trim() ||
    [...form.name].length > 256
  ) {
    error.value =
      '类型须以小写字母开头，仅含小写字母、数字和下划线，最多 64 字符；名称须为 1–256 字符';
    return;
  }
  busy.value = true;
  emit('busy', true);
  try {
    const input = {
      ...form,
      type: props.dictionary?.builtin ? props.dictionary.type : form.type,
    };
    const result = props.dictionary
      ? await updateDictionaryApi(props.dictionary.id, input)
      : await createDictionaryApi(input);
    emit('saved', result);
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
    :title="dictionary ? '编辑业务字典' : '新增业务字典'"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item
        label="字典类型"
        :help="
          dictionary?.builtin
            ? '内置类型不可修改'
            : '小写字母开头，可含数字和下划线，最多 64 字符'
        "
        required
      >
        <Input
          v-model:value="form.type"
          aria-label="字典类型"
          :maxlength="64"
          :disabled="dictionary?.builtin"
        />
      </Form.Item>
      <Form.Item label="字典名称" required>
        <Input
          v-model:value="form.name"
          aria-label="字典名称"
          :maxlength="256"
        />
      </Form.Item>
      <Form.Item label="状态">
        <Select
          v-model:value="form.status"
          aria-label="字典状态"
          :options="options"
        />
      </Form.Item>
      <Space>
        <Button
          v-if="allowed"
          type="primary"
          html-type="submit"
          :loading="busy"
        >
          保存字典
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
