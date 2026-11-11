<script setup lang="ts">
import type { AdminRole } from '#/api/model/system';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Modal,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { deleteRoleApi, getRoleApi, getRolesApi } from '#/api/core/system';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import RoleForm from './role-form.vue';
import RoleGrants from './role-grants.vue';
import { dataScopeLabels } from './role-options';

defineOptions({ name: 'SystemRoleList' });
const roles = ref<AdminRole[]>([]);
const loading = ref(false);
const acting = ref(false);
const error = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const editing = ref<AdminRole>();
const formOpen = ref(false);
const granting = ref<AdminRole>();
let sequence = 0;
const columns = [
  { dataIndex: 'name', title: '角色名称' },
  { dataIndex: 'code', title: '编码' },
  { dataIndex: 'data_scope', title: '数据范围' },
  { dataIndex: 'status', title: '状态' },
  { dataIndex: 'remark', title: '备注' },
  { dataIndex: 'actions', title: '操作', width: 240 },
];
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
}));
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getRolesApi(page.value, pageSize.value);
    if (current !== sequence) return;
    roles.value = result.list;
    total.value = result.total;
  } catch (error_) {
    if (current === sequence) {
      error.value = toApiError(error_).message;
      roles.value = [];
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}
async function edit(role?: AdminRole) {
  acting.value = true;
  error.value = '';
  try {
    editing.value = role ? await getRoleApi(role.id) : undefined;
    formOpen.value = true;
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    acting.value = false;
  }
}
async function saved() {
  formOpen.value = false;
  await load();
  message.success('角色已保存');
}
function remove(role: AdminRole) {
  Modal.confirm({
    title: `删除角色 ${role.name}？`,
    content: '请先解除用户关联以及菜单、权限、部门授权。',
    okType: 'danger',
    async onOk() {
      acting.value = true;
      error.value = '';
      try {
        await deleteRoleApi(role.id);
        if (roles.value.length === 1 && page.value > 1) page.value--;
        await load();
        message.success('角色已删除');
      } catch (error_) {
        const failure = toApiError(error_);
        error.value =
          failure.status === 409
            ? '角色仍被引用或受保护，请先解除用户关联及菜单、权限、部门授权后重试（409）。'
            : failure.message;
      } finally {
        acting.value = false;
      }
    },
  });
}
async function changePage(value: { current?: number; pageSize?: number }) {
  page.value = value.pageSize === pageSize.value ? (value.current ?? 1) : 1;
  pageSize.value = value.pageSize ?? 20;
  await load();
}
onMounted(load);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page title="角色管理" description="配置角色、菜单访问、接口权限和数据范围。">
    <Card title="角色列表">
      <template #extra>
        <Button
          v-if="hasPermission('system:role:create')"
          type="primary"
          :disabled="acting"
          @click="edit()"
        >
          新建角色
        </Button>
      </template>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="load">刷新</Button>
        </template>
      </Alert>
      <Table
        data-testid="role-table"
        :columns="columns"
        :data-source="roles"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1000 }"
        row-key="id"
        @change="changePage"
      >
        <template #bodyCell="{ column, record, text }">
          <Tag
            v-if="column.dataIndex === 'status'"
            :color="text === 'active' ? 'success' : 'default'"
          >
            {{ text === 'active' ? '启用' : '禁用' }}
          </Tag>
          <template v-else-if="column.dataIndex === 'data_scope'">
            {{ dataScopeLabels[record.data_scope as AdminRole['data_scope']] }}
          </template>
          <Space v-else-if="column.dataIndex === 'actions'" wrap>
            <Button
              v-if="hasPermission('system:role:update')"
              size="small"
              :disabled="acting"
              @click="edit(record as AdminRole)"
            >
              编辑
            </Button>
            <Button
              v-if="hasPermission('system:role:grant')"
              size="small"
              :disabled="acting"
              @click="granting = record as AdminRole"
            >
              授权
            </Button>
            <Button
              v-if="hasPermission('system:role:delete')"
              size="small"
              danger
              :disabled="acting"
              @click="remove(record as AdminRole)"
            >
              删除
            </Button>
          </Space>
          <template v-else>{{ text || '—' }}</template>
        </template>
      </Table>
    </Card>
    <RoleForm
      v-if="formOpen"
      :role="editing"
      @close="formOpen = false"
      @saved="saved"
    />
    <RoleGrants
      v-if="granting"
      :role="granting"
      @close="granting = undefined"
      @changed="load"
    />
  </Page>
</template>
