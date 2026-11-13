<script setup lang="ts">
import type { SettingDraft } from './settings-schema';

import type { SettingGroup } from '#/api/model/configuration';

import { computed, ref, watch } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  message,
  Select,
  Switch,
  Tag,
} from 'ant-design-vue';

import { updateSettingGroupApi } from '#/api/core/settings';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import {
  settingChanges,
  settingDraft,
  settingRange,
  validateSettings,
} from './settings-schema';

const props = defineProps<{ group: SettingGroup }>();
const emit = defineEmits<{
  busy: [value: boolean];
  saved: [group: SettingGroup];
}>();
const draft = ref<SettingDraft>({});
const busy = ref(false);
const error = ref('');
const errors = ref<Record<string, string>>({});
const allowed = computed(() => hasPermission('system:setting:update'));
watch(
  () => props.group,
  (group) => {
    draft.value = settingDraft(group);
    errors.value = {};
    error.value = '';
  },
  { immediate: true },
);
async function save() {
  if (busy.value || !allowed.value) return;
  error.value = '';
  errors.value = validateSettings(props.group, draft.value);
  if (Object.keys(errors.value).length > 0) return;
  const changes = settingChanges(props.group, draft.value);
  if (Object.keys(changes).length === 0) {
    message.info('没有需要保存的修改');
    return;
  }
  busy.value = true;
  emit('busy', true);
  try {
    const result = await updateSettingGroupApi(props.group.group, changes);
    emit('saved', result);
    message.success('已保存，部分配置对新会话生效');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}
</script>

<template>
  <div :data-setting-group="group.group">
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form
      :model="draft"
      layout="vertical"
      :disabled="busy || !allowed"
      class="max-w-3xl"
      @finish="save"
    >
      <Form.Item
        v-for="{ schema } in group.items"
        :key="schema.key"
        :validate-status="errors[schema.key] ? 'error' : undefined"
        :help="errors[schema.key]"
        :data-setting-key="schema.key"
      >
        <template #label>
          <span>{{ schema.desc }}</span>
          <Tag v-if="schema.read_only" class="ml-2">不可修改</Tag>
        </template>
        <Select
          v-if="schema.enum?.length"
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="schema.read_only || busy || !allowed"
          :options="schema.enum.map((value) => ({ value, label: value }))"
          @update:value="draft[schema.key] = String($event)"
        />
        <InputNumber
          v-else-if="schema.type === 'number'"
          :value="(draft[schema.key] as null | number) ?? undefined"
          :aria-label="schema.desc"
          :disabled="schema.read_only || busy || !allowed"
          :step="1"
          :style="{ width: '100%', maxWidth: '24rem' }"
          @update:value="draft[schema.key] = $event"
        />
        <Switch
          v-else-if="schema.type === 'boolean'"
          :checked="draft[schema.key] === true"
          :aria-label="schema.desc"
          :disabled="schema.read_only || busy || !allowed"
          @update:checked="draft[schema.key] = $event"
        />
        <Input.TextArea
          v-else-if="schema.type === 'json'"
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="schema.read_only || busy || !allowed"
          :rows="4"
          @update:value="draft[schema.key] = $event"
        />
        <Input
          v-else
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="schema.read_only || busy || !allowed"
          @update:value="draft[schema.key] = $event"
        />
        <div class="mt-1 space-y-1 text-xs text-muted-foreground">
          <div>
            {{ schema.key }} · 默认值：{{ JSON.stringify(schema.default) }}
          </div>
          <div v-if="settingRange(schema)">{{ settingRange(schema) }}</div>
          <div>
            {{
              schema.hot_reload
                ? '后续请求读取此配置'
                : '当前仅保存与展示，实际生效取决于使用方'
            }}
          </div>
        </div>
      </Form.Item>
      <Button v-if="allowed" type="primary" html-type="submit" :loading="busy">
        保存配置
      </Button>
    </Form>
  </div>
</template>
