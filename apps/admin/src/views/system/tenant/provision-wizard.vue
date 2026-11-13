<script setup lang="ts">
import type { TenantTemplate } from '#/api/model/tenant';

import { onDeactivated, onUnmounted, reactive, ref } from 'vue';

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
let alive = true;
function basicValid() {
  if (!/^[a-z][a-z0-9_-]{0,63}$/.test(form.code)) {
    error.value =
      'Code 须以小写字母开头，仅含小写字母、数字、下划线或短横线，最多 64 字符';
    return false;
  }
  if (!form.name.trim() || [...form.name].length > 128) {
    error.value = '名称须为 1–128 字符';
    return false;
  }
  return true;
}
function next() {
  error.value = '';
  if (basicValid()) step.value = 1;
}
async function submit() {
  if (busy.value || !canManageTenants()) return;
  error.value = '';
  if (!basicValid()) {
    step.value = 0;
    return;
  }
  const templateId = form.template_id;
  if (
    templateId === undefined ||
    !props.templates.some((item) => item.id === templateId)
  ) {
    error.value = '请选择租户模板';
    return;
  }
  if (!form.admin_username.trim() || [...form.admin_username].length > 256) {
    error.value = '管理员用户名须为 1–256 字符';
    return;
  }
  const email = form.admin_email.trim();
  if (
    email &&
    (email.length > 256 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
  ) {
    error.value = '请填写有效的管理员邮箱（最多 256 字符），或留空';
    return;
  }
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
          help="小写字母开头，最多 64 字符；创建后不可修改"
          required
        >
          <Input
            v-model:value="form.code"
            aria-label="租户 Code"
            :maxlength="64"
            autocomplete="off"
          />
        </Form.Item>
        <Form.Item label="租户名称" required>
          <Input
            v-model:value="form.name"
            aria-label="租户名称"
            :maxlength="128"
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
        <Form.Item label="租户模板" required>
          <Select
            v-model:value="form.template_id"
            aria-label="租户模板"
            show-search
            option-filter-prop="label"
            :options="
              templates.map((item) => ({
                value: item.id,
                label: `${item.name}（${item.roles.length} 个角色）`,
              }))
            "
          />
        </Form.Item>
        <Form.Item label="管理员用户名" required>
          <Input
            v-model:value="form.admin_username"
            aria-label="管理员用户名"
            :maxlength="256"
            autocomplete="off"
          />
        </Form.Item>
        <Form.Item label="管理员邮箱（可选）">
          <Input
            v-model:value="form.admin_email"
            aria-label="管理员邮箱"
            :maxlength="256"
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
    }。邀请链接 7 天内有效，仅可使用一次。对方的密码由本人设置，你无法看到。关闭后链接即丢弃；如需重发，请到用户页生成重置链接。`"
    @close="close"
  />
</template>
