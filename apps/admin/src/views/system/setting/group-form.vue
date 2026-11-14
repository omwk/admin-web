<script setup lang="ts">
import type { SettingDraft } from './settings-schema';

import type { SettingGroup } from '#/api/model/configuration';
import type { AdminRole } from '#/api/model/system';

import { computed, onMounted, onUnmounted, ref, watch } from 'vue';

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
import { getAllRolesApi } from '#/api/core/system';
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
const registration = computed(() => props.group.group === 'tenant');
const allowed = computed(
  () =>
    hasPermission('system:setting:update') ||
    (registration.value && hasPermission('system:tenant:manage')),
);
const roles = ref<AdminRole[]>([]);
const rolesLoading = ref(false);
const rolesError = ref('');
let disposed = false;
const roleOptions = computed(() => {
  const options = [
    { value: '', label: '无角色（最小权限）' },
    ...roles.value
      .filter((role) => role.status === 'active')
      .map((role) => ({
        value: role.code,
        label: `${role.name}（${role.code}）`,
      })),
  ];
  const current = String(draft.value.default_role_code ?? '');
  if (current && !options.some((option) => option.value === current))
    options.push({
      value: current,
      label: `${current}（当前配置，角色不可用）`,
    });
  return options;
});
function disabled(key: string, readOnly: boolean) {
  return (
    readOnly ||
    busy.value ||
    !allowed.value ||
    (registration.value &&
      key !== 'allow_self_registration' &&
      draft.value.allow_self_registration !== true)
  );
}
async function loadRoles() {
  if (!registration.value || rolesLoading.value) return;
  rolesLoading.value = true;
  rolesError.value = '';
  try {
    const result = await getAllRolesApi();
    if (!disposed) roles.value = result;
  } catch (error_) {
    if (!disposed) rolesError.value = toApiError(error_).message;
  } finally {
    if (!disposed) rolesLoading.value = false;
  }
}
onMounted(loadRoles);
onUnmounted(() => {
  disposed = true;
});
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
    message.success(
      registration.value ? '已生效' : '已保存，部分配置对新会话生效',
    );
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
          v-if="registration && schema.key === 'default_role_code'"
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          :loading="rolesLoading"
          :options="roleOptions"
          @update:value="draft[schema.key] = String($event)"
        />
        <Select
          v-else-if="schema.enum?.length"
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          :options="schema.enum.map((value) => ({ value, label: value }))"
          @update:value="draft[schema.key] = String($event)"
        />
        <InputNumber
          v-else-if="schema.type === 'number'"
          :value="(draft[schema.key] as null | number) ?? undefined"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          :min="registration ? schema.min : undefined"
          :max="registration ? schema.max : undefined"
          :step="1"
          :style="{ width: '100%', maxWidth: '24rem' }"
          @update:value="draft[schema.key] = $event"
        />
        <Switch
          v-else-if="schema.type === 'boolean'"
          :checked="draft[schema.key] === true"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          @update:checked="draft[schema.key] = $event"
        />
        <Input.TextArea
          v-else-if="schema.type === 'json'"
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          :rows="4"
          @update:value="draft[schema.key] = $event"
        />
        <Input
          v-else
          :value="String(draft[schema.key] ?? '')"
          :aria-label="schema.desc"
          :disabled="disabled(schema.key, schema.read_only)"
          @update:value="draft[schema.key] = $event"
        />
        <Alert
          v-if="registration && schema.key === 'allow_self_registration'"
          type="warning"
          show-icon
          message="自助注册风险提示"
          class="mt-3"
        >
          <template #description>
            <p>开启后，任何知道本企业代码的人都可以注册账号。</p>
            <p>新用户需要完成邮箱验证才能登录。</p>
            <p>非首位用户将获得「默认角色」的权限——请确认它不是高权限角色。</p>
          </template>
        </Alert>
        <Alert
          v-if="schema.key === 'default_role_code' && rolesError"
          type="error"
          :message="`角色列表加载失败：${rolesError}`"
          class="mt-2"
        >
          <template #action>
            <Button size="small" @click="loadRoles">重试</Button>
          </template>
        </Alert>
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
