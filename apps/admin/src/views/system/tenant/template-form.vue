<script setup lang="ts">
import type { Tenant, TenantTemplate } from '#/api/model/tenant';

import { reactive, ref } from 'vue';

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
  createTenantTemplateApi,
  updateTenantTemplateApi,
} from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants } from '#/auth/tenant';

const props = defineProps<{ tenants: Tenant[]; template?: TenantTemplate }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const busy = ref(false);
const error = ref('');
const form = reactive({
  source_tenant_id: undefined as number | undefined,
  code: props.template?.code ?? '',
  name: props.template?.name ?? '',
  description: props.template?.description ?? '',
});
async function save() {
  if (busy.value || !canManageTenants()) return;
  error.value = '';
  const sourceTenant = props.tenants.find(
    (tenant) => tenant.id === form.source_tenant_id,
  );
  if (
    !props.template &&
    (!sourceTenant || !/^[a-z][a-z0-9_-]{0,63}$/.test(form.code))
  ) {
    error.value =
      '请选择来源租户；Code 须以小写字母开头，仅含小写字母、数字、下划线或短横线，最多 64 字符';
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
  busy.value = true;
  try {
    const input = { name: form.name, description: form.description };
    if (props.template) {
      await updateTenantTemplateApi(props.template.id, input);
    } else if (sourceTenant) {
      await createTenantTemplateApi({
        ...input,
        code: form.code,
        source_tenant_id: sourceTenant.id,
      });
    }
    emit('saved');
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
    :title="template ? '编辑租户模板' : '从租户生成模板'"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Alert
      v-if="!template"
      message="快照包含角色、菜单和权限；不复制业务数据。生成后不随来源租户变化。"
      type="info"
      class="mb-4"
    />
    <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item v-if="!template" label="来源租户" required>
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
          :disabled="Boolean(template)"
        />
      </Form.Item>
      <Form.Item label="模板名称" required>
        <Input
          v-model:value="form.name"
          aria-label="模板名称"
          :maxlength="128"
        />
      </Form.Item>
      <Form.Item label="模板描述">
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
          {{ template ? '保存模板' : '生成快照' }}
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </Modal>
</template>
