<script setup lang="ts">
import type { Tenant, TenantTemplate } from '#/api/model/tenant';

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
  cloneTenantTemplateApi,
  createTenantTemplateApi,
} from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants } from '#/auth/tenant';

const props = defineProps<{
  tenants: Tenant[];
  mode: 'blank' | 'clone' | 'snapshot';
  template?: TenantTemplate;
}>();
const emit = defineEmits<{ close: []; saved: [template: TenantTemplate] }>();
const busy = ref(false);
const error = ref('');
const title = computed(
  () =>
    ({ blank: '新建空白模板', clone: '复制模板', snapshot: '从租户创建模板' })[
      props.mode
    ],
);
const form = reactive({
  source_tenant_id: undefined as number | undefined,
  code: '',
  name: props.mode === 'clone' ? `${props.template?.name ?? ''}（副本）` : '',
  description: '',
});
async function save() {
  if (busy.value || !canManageTenants()) return;
  error.value = '';
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(form.code)) {
    error.value =
      'Code 须以小写字母开头，仅含小写字母、数字、下划线或短横线，最多 64 字符';
    return;
  }
  if (
    !form.name.trim() ||
    [...form.name].length > 128 ||
    [...form.description].length > 1000
  ) {
    error.value = '名称须为 1–128 字符，描述最多 1000 字符';
    return;
  }
  if (
    props.mode === 'snapshot' &&
    !props.tenants.some((tenant) => tenant.id === form.source_tenant_id)
  ) {
    error.value = '请选择来源租户';
    return;
  }
  if (props.mode === 'clone' && !props.template) return;
  busy.value = true;
  try {
    const identity = { code: form.code, name: form.name.trim() };
    const created =
      props.mode === 'clone' && props.template
        ? await cloneTenantTemplateApi(props.template.id, identity)
        : await createTenantTemplateApi({
            ...identity,
            description: form.description,
            ...(props.mode === 'snapshot'
              ? { source_tenant_id: form.source_tenant_id }
              : {}),
          });
    emit('saved', created);
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    :open="true"
    :title="title"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Alert
      :message="
        mode === 'snapshot'
          ? '快照包含角色、菜单和权限；不复制业务数据。生成后不随来源租户变化。'
          : mode === 'clone'
            ? '复制已保存的角色、权限与菜单；副本的修改不影响原模板。'
            : '空白模板不含角色，创建后进入编辑页添加角色与权限。菜单由模板框架提供。'
      "
      type="info"
      class="mb-4"
    />
    <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item v-if="mode === 'snapshot'" label="来源租户" required>
        <Select
          v-model:value="form.source_tenant_id"
          aria-label="来源租户"
          show-search
          option-filter-prop="label"
          :options="
            tenants.map((tenant) => ({
              value: tenant.id,
              label: `${tenant.name}（${tenant.code}）`,
            }))
          "
        />
      </Form.Item>
      <Form.Item label="模板 Code" help="创建后不可修改" required>
        <Input
          v-model:value="form.code"
          aria-label="模板 Code"
          :maxlength="64"
        />
      </Form.Item>
      <Form.Item label="模板名称" required>
        <Input
          v-model:value="form.name"
          aria-label="模板名称"
          :maxlength="128"
        />
      </Form.Item>
      <Form.Item v-if="mode !== 'clone'" label="模板描述">
        <Input.TextArea
          v-model:value="form.description"
          aria-label="模板描述"
          :maxlength="1000"
          :rows="3"
        />
      </Form.Item>
      <Space>
        <Button
          v-if="canManageTenants()"
          type="primary"
          html-type="submit"
          :loading="busy"
        >
          {{
            mode === 'snapshot'
              ? '生成快照'
              : mode === 'clone'
                ? '确认复制'
                : '创建并编辑'
          }}
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
