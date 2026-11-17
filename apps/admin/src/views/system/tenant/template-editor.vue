<script setup lang="ts">
import type { PermissionGroups } from '#/api/model/system';
import type {
  TenantTemplate,
  TenantTemplateRole,
  TenantTemplateUpdate,
} from '#/api/model/tenant';

import { computed, onMounted, onUnmounted, reactive, ref, watch } from 'vue';
import {
  onBeforeRouteLeave,
  onBeforeRouteUpdate,
  useRoute,
  useRouter,
} from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import { getPermissionsApi } from '#/api/core/system';
import {
  getTenantTemplateApi,
  updateTenantTemplateApi,
} from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants } from '#/auth/tenant';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import { templateDraft, validateTemplateDraft } from './template-editor-state';
import TemplateRoleForm from './template-role-form.vue';
import TemplateRolePanel from './template-role-panel.vue';

defineOptions({ name: 'SystemTenantTemplateEditor' });
const route = useRoute();
const router = useRouter();
const template = ref<TenantTemplate>();
const groups = ref<PermissionGroups>({});
const form = reactive<TenantTemplateUpdate>({
  name: '',
  description: '',
  roles: [],
});
const baseline = ref('');
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const adding = ref(false);
const selectedIndex = ref(0);
let sequence = 0;
const dirty = computed(
  () => Boolean(baseline.value) && JSON.stringify(form) !== baseline.value,
);
const selectedRole = computed({
  get: () => form.roles[selectedIndex.value],
  set: (role: TenantTemplateRole | undefined) => {
    if (role) form.roles[selectedIndex.value] = role;
  },
});
function confirm(title: string, content: string, okText: string) {
  return new Promise<boolean>((resolve) => {
    Modal.confirm({
      title,
      content,
      okText,
      cancelText: '取消',
      onOk: () => {
        resolve(true);
      },
      onCancel: () => {
        resolve(false);
      },
    });
  });
}
async function load() {
  if (!canManageTenants()) return;
  const current = ++sequence;
  const id = Number(route.params.id);
  template.value = undefined;
  baseline.value = '';
  error.value = '';
  if (!Number.isSafeInteger(id) || id <= 0) {
    error.value = '无效的模板 ID';
    return;
  }
  loading.value = true;
  try {
    const [detail, permissions] = await Promise.all([
      getTenantTemplateApi(id),
      getPermissionsApi(),
    ]);
    if (current !== sequence) return;
    template.value = detail;
    groups.value = permissions;
    Object.assign(form, templateDraft(detail));
    baseline.value = JSON.stringify(form);
    selectedIndex.value = 0;
    adding.value = false;
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
function addRole(role: TenantTemplateRole) {
  if (busy.value || !canManageTenants() || form.roles.length >= 50) return;
  form.roles.push(role);
  selectedIndex.value = form.roles.length - 1;
  adding.value = false;
}
async function removeRole() {
  const role = selectedRole.value;
  if (!role || busy.value || !canManageTenants()) return;
  if (
    !(await confirm(
      `删除角色「${role.name || role.code}」？`,
      '角色将在保存模板后移除；已开通租户不受影响。',
      '删除角色',
    ))
  )
    return;
  form.roles.splice(selectedIndex.value, 1);
  selectedIndex.value = Math.max(0, selectedIndex.value - 1);
}
async function save() {
  if (!template.value || busy.value || loading.value || !canManageTenants())
    return;
  error.value = '';
  const invalid = validateTemplateDraft(form);
  if (invalid) {
    error.value = invalid.message;
    if (invalid.index !== undefined) selectedIndex.value = invalid.index;
    return;
  }
  busy.value = true;
  const current = sequence;
  try {
    const empty = form.roles.filter((role) => role.permissions.length === 0);
    if (
      empty.length > 0 &&
      !(await confirm(
        '部分角色未配置权限',
        `以下角色没有权限：${empty.map((role) => role.name).join('、')}。仍要保存吗？`,
        '仍然保存',
      ))
    )
      return;
    const result = await updateTenantTemplateApi(
      template.value.id,
      templateDraft({ ...template.value, ...form }),
    );
    if (current !== sequence) return;
    template.value = result;
    Object.assign(form, templateDraft(result));
    baseline.value = JSON.stringify(form);
    message.success('模板已保存');
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
function beforeUnload(event: BeforeUnloadEvent) {
  if (!dirty.value) return;
  event.preventDefault();
  event.returnValue = '';
}
async function beforeLeave() {
  if (busy.value) return false;
  return (
    !dirty.value ||
    (await confirm(
      '模板有未保存的修改',
      '离开后将丢失这些修改，确定离开吗？',
      '放弃修改并离开',
    ))
  );
}
onBeforeRouteLeave(beforeLeave);
onBeforeRouteUpdate(beforeLeave);
watch(() => route.params.id, load, { immediate: true });
onMounted(() => window.addEventListener('beforeunload', beforeUnload));
onUnmounted(() => {
  sequence++;
  window.removeEventListener('beforeunload', beforeUnload);
});
</script>

<template>
  <Forbidden v-if="!canManageTenants()" />
  <Page
    v-else
    title="编辑租户模板"
    description="配置开通租户时使用的角色与权限；保存不会改变已经开通的租户。"
  >
    <Space class="mb-4" wrap>
      <Button
        :disabled="busy"
        @click="router.push('/system/tenants/templates')"
      >
        返回模板列表
      </Button>
      <Button
        type="primary"
        :loading="busy"
        :disabled="!template || loading || !dirty"
        @click="save"
      >
        保存模板
      </Button>
      <Tag v-if="dirty" color="orange">未保存</Tag>
    </Space>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Button v-if="error && !template && !loading" @click="load">
      重新加载
    </Button>
    <Spin :spinning="loading">
      <template v-if="template">
        <Card title="模板信息" class="mb-4">
          <Form layout="vertical" :disabled="busy">
            <div class="grid gap-x-4 md:grid-cols-2">
              <Form.Item label="模板名称" required>
                <Input
                  v-model:value="form.name"
                  aria-label="模板名称"
                  :maxlength="128"
                />
              </Form.Item>
              <Form.Item label="模板 Code" help="创建后不可修改">
                <Input :value="template.code" aria-label="模板 Code" disabled />
              </Form.Item>
            </div>
            <Form.Item label="模板描述" class="!mb-0">
              <Input.TextArea
                v-model:value="form.description"
                aria-label="模板描述"
                :maxlength="1000"
                :rows="2"
              />
            </Form.Item>
          </Form>
        </Card>
        <div
          class="grid items-start gap-4 lg:grid-cols-[260px_minmax(0,1fr)]"
          data-testid="template-editor"
        >
          <Card :title="`角色（${form.roles.length}/50）`">
            <div
              class="mb-4 flex flex-col gap-2"
              data-testid="template-role-list"
            >
              <Button
                v-for="(role, index) in form.roles"
                :key="role.code"
                :type="selectedIndex === index ? 'primary' : 'default'"
                :disabled="busy"
                class="!h-auto !whitespace-normal !text-left"
                :aria-pressed="selectedIndex === index"
                @click="selectedIndex = index"
              >
                <span class="!flex w-full flex-col items-start gap-1">
                  <span class="break-all">{{ role.name || '未命名角色' }}</span>
                  <span class="text-xs">
                    {{ role.code }} ·
                    {{ new Set(role.permissions).size }} 个权限
                  </span>
                </span>
              </Button>
            </div>
            <Button
              block
              :disabled="busy || form.roles.length >= 50"
              @click="adding = true"
            >
              添加角色
            </Button>
          </Card>
          <Card title="角色权限配置">
            <template #extra>
              <Button
                v-if="selectedRole"
                danger
                :disabled="busy"
                @click="removeRole"
              >
                删除角色
              </Button>
            </template>
            <TemplateRolePanel
              v-if="selectedRole"
              v-model:role="selectedRole"
              :groups="groups"
              :menus="template.menus"
              :disabled="busy"
            />
            <Empty
              v-else
              description="模板尚未配置角色，请添加角色后勾选权限。"
            />
          </Card>
        </div>
        <TemplateRoleForm
          v-if="adding && !busy"
          :codes="form.roles.map((role) => role.code)"
          :menu-keys="template.menus.map((menu) => menu.key)"
          @close="adding = false"
          @added="addRole"
        />
      </template>
    </Spin>
  </Page>
</template>
