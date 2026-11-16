<script setup lang="ts">
import type { TenantTemplate } from '#/api/model/tenant';

import { nextTick, onDeactivated, onUnmounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  Modal,
  Select,
  Space,
  Steps,
} from 'ant-design-vue';

import { provisionTenantApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { frontendAccountLink } from '#/auth/account-link';
import { canManageTenants } from '#/auth/tenant';

import LinkModal from '../shared/link-modal.vue';

const props = defineProps<{ templates: TenantTemplate[] }>();
const emit = defineEmits<{ close: []; created: []; templates: [] }>();
const step = ref(0);
const phase = ref<'form' | 'link'>('form');
const busy = ref(false);
const error = ref('');
const link = ref('');
const tenantId = ref(0);
const form = reactive({
  code: '',
  name: '',
  template_id: undefined as number | undefined,
  admin_username: '',
  admin_email: '',
});
type Field = keyof typeof form;
type FieldInput = { focus: () => void };
const fieldErrors = reactive<Record<Field, string>>({
  code: '',
  name: '',
  template_id: '',
  admin_username: '',
  admin_email: '',
});
const fieldInputs = {
  code: ref<FieldInput>(),
  name: ref<FieldInput>(),
  template_id: ref<FieldInput>(),
  admin_username: ref<FieldInput>(),
  admin_email: ref<FieldInput>(),
};
let alive = true;
function validateField(field: Field, required = false) {
  const value = form[field];
  let message = '';
  if (
    required ||
    (typeof value === 'string' ? value.trim() !== '' : value !== undefined)
  ) {
    switch (field) {
      case 'admin_email': {
        const email = form.admin_email.trim();
        if (
          email &&
          (email.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
        ) {
          message = '请填写有效的管理员邮箱（最多 256 字符），或留空';
        }
        break;
      }
      case 'admin_username': {
        if (
          !form.admin_username.trim() ||
          [...form.admin_username].length > 256
        ) {
          message = '管理员用户名须为 1–256 字符';
        }
        break;
      }
      case 'code': {
        if (!/^[a-z][a-z0-9_-]{0,63}$/.test(form.code)) {
          message =
            'Code 须以小写字母开头，仅含小写字母、数字、下划线或短横线，最多 64 字符';
        }
        break;
      }
      case 'name': {
        if (!form.name.trim() || [...form.name].length > 128) {
          message = '名称须为 1–128 字符';
        }
        break;
      }
      case 'template_id': {
        if (!props.templates.some((item) => item.id === form.template_id)) {
          message = '请选择租户模板';
        }
        break;
      }
    }
  }
  fieldErrors[field] = message;
}
function revalidateField(field: Field) {
  if (fieldErrors[field]) validateField(field, true);
}
function validateFields(fields: Field[]) {
  fields.forEach((field) => validateField(field, true));
  const firstError = fields.find((field) => fieldErrors[field]);
  if (firstError) {
    step.value = firstError === 'code' || firstError === 'name' ? 0 : 1;
    void nextTick(() => fieldInputs[firstError].value?.focus());
    return false;
  }
  return true;
}
function next() {
  error.value = '';
  if (validateFields(['code', 'name'])) step.value = 1;
}
async function submit() {
  if (busy.value || !canManageTenants()) return;
  error.value = '';
  const templateId = form.template_id;
  if (
    !validateFields([
      'code',
      'name',
      'template_id',
      'admin_username',
      'admin_email',
    ]) ||
    templateId === undefined
  ) {
    return;
  }
  const email = form.admin_email.trim();
  busy.value = true;
  try {
    const result = await provisionTenantApi({
      code: form.code,
      name: form.name,
      template_id: templateId,
      admin_username: form.admin_username.trim(),
      ...(email ? { admin_email: email } : {}),
    });
    if (!alive) return;
    link.value = frontendAccountLink(result.invite_url, window.location.origin);
    tenantId.value = result.tenant_id;
    phase.value = 'link';
    emit('created');
  } catch (error_) {
    if (alive) error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
function close() {
  link.value = '';
  emit('close');
}
onDeactivated(close);
onUnmounted(() => {
  alive = false;
  link.value = '';
});
</script>

<template>
  <Modal
    v-if="phase === 'form'"
    :open="true"
    title="开通租户"
    :footer="null"
    :mask-closable="false"
    :closable="!busy"
    :keyboard="!busy"
    @cancel="close"
  >
    <Steps
      :current="step"
      :items="[{ title: '基本信息' }, { title: '模板与管理员' }]"
      class="mb-6"
    />
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form
      :model="form"
      layout="vertical"
      :disabled="busy"
      @finish="step === 0 ? next() : submit()"
    >
      <template v-if="step === 0">
        <Form.Item
          label="租户 Code"
          :validate-status="fieldErrors.code ? 'error' : undefined"
          :help="
            fieldErrors.code || '小写字母开头，最多 64 字符；创建后不可修改'
          "
          required
        >
          <Input
            :ref="fieldInputs.code"
            v-model:value="form.code"
            aria-label="租户 Code"
            :aria-invalid="Boolean(fieldErrors.code)"
            :maxlength="64"
            autocomplete="off"
            @blur="validateField('code')"
            @update:value="revalidateField('code')"
          />
        </Form.Item>
        <Form.Item
          label="租户名称"
          :validate-status="fieldErrors.name ? 'error' : undefined"
          :help="fieldErrors.name || undefined"
          required
        >
          <Input
            :ref="fieldInputs.name"
            v-model:value="form.name"
            aria-label="租户名称"
            :aria-invalid="Boolean(fieldErrors.name)"
            :maxlength="128"
            @blur="validateField('name')"
            @update:value="revalidateField('name')"
          />
        </Form.Item>
      </template>
      <template v-else>
        <Alert
          v-if="templates.length === 0"
          message="暂无租户模板，请先从现有租户生成快照。"
          type="info"
          class="mb-4"
        >
          <template #action>
            <Button
              v-if="canManageTenants()"
              size="small"
              @click="emit('templates')"
            >
              生成模板
            </Button>
          </template>
        </Alert>
        <Form.Item
          label="租户模板"
          :validate-status="fieldErrors.template_id ? 'error' : undefined"
          :help="fieldErrors.template_id || undefined"
          required
        >
          <Select
            :ref="fieldInputs.template_id"
            v-model:value="form.template_id"
            aria-label="租户模板"
            :aria-invalid="Boolean(fieldErrors.template_id)"
            show-search
            option-filter-prop="label"
            :options="
              templates.map((item) => ({
                value: item.id,
                label: `${item.name}（${item.roles.length} 个角色）`,
              }))
            "
            @blur="validateField('template_id')"
            @update:value="revalidateField('template_id')"
          />
        </Form.Item>
        <Form.Item
          label="管理员用户名"
          :validate-status="fieldErrors.admin_username ? 'error' : undefined"
          :help="fieldErrors.admin_username || undefined"
          required
        >
          <Input
            :ref="fieldInputs.admin_username"
            v-model:value="form.admin_username"
            aria-label="管理员用户名"
            :aria-invalid="Boolean(fieldErrors.admin_username)"
            :maxlength="256"
            autocomplete="off"
            @blur="validateField('admin_username')"
            @update:value="revalidateField('admin_username')"
          />
        </Form.Item>
        <Form.Item
          label="管理员邮箱（可选）"
          :validate-status="fieldErrors.admin_email ? 'error' : undefined"
          :help="fieldErrors.admin_email || undefined"
          extra="填了就必须是合法邮箱；留空也可以，管理员可用邀请链接自行设置。"
        >
          <Input
            :ref="fieldInputs.admin_email"
            v-model:value="form.admin_email"
            aria-label="管理员邮箱"
            :aria-invalid="Boolean(fieldErrors.admin_email)"
            :maxlength="256"
            placeholder="例如 ops@acme.com"
            @blur="validateField('admin_email')"
            @update:value="revalidateField('admin_email')"
          />
        </Form.Item>
        <p class="mb-4 text-sm text-muted-foreground">
          管理员通过邀请链接自行设置密码，你无法看到。
        </p>
      </template>
      <Space>
        <Button
          v-if="step === 1"
          :disabled="busy"
          @click="
            step = 0;
            error = '';
          "
        >
          上一步
        </Button>
        <Button
          v-if="canManageTenants()"
          type="primary"
          html-type="submit"
          :loading="busy"
          :disabled="step === 1 && templates.length === 0"
        >
          {{ step === 0 ? '下一步' : '确认开通' }}
        </Button>
        <Button :disabled="busy" @click="close">取消</Button>
      </Space>
    </Form>
  </Modal>
  <LinkModal
    v-if="phase === 'link' && link"
    :open="true"
    :link="link"
    title="邀请链接（仅本次显示）"
    :description="`租户 ID：${
      tenantId
    }。邀请链接 7 天内有效，仅可使用一次。对方的密码由本人设置，你无法看到。关闭后链接即丢弃；如需重发，请在租户列表重新签发管理员邀请。`"
    @close="close"
  />
</template>
