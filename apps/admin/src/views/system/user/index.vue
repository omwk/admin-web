<script lang="ts" setup>
import type { AdminUser, UserStatus } from '#/api/model/admin-user';
import type { AdminRole, Department } from '#/api/model/system';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Input,
  message,
  Modal,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  createResetLinkApi,
  deleteUserApi,
  getUserApi,
  getUserRolesApi,
  resetUserPasswordApi,
  unlockUserApi,
  updateUserApi,
} from '#/api/core/admin-users';
import { getAllRolesApi, getDepartmentsApi } from '#/api/core/system';
import { toApiError } from '#/api/errors';
import { frontendAccountLink, passwordError } from '#/auth/account-link';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';

import LinkModal from '../shared/link-modal.vue';
import { nodeLabel } from '../shared/tree';
import InvitePanel from './invite-panel.vue';
import { useUserList } from './use-user-list';
import UserForm from './user-form.vue';
import UserRoles from './user-roles.vue';

defineOptions({ name: 'SystemUserList' });
const {
  changePage,
  dispose,
  error,
  keyword,
  load,
  loading,
  page,
  pageSize,
  reset,
  search,
  status,
  total,
  users,
} = useUserList();
const departments = ref<Department[]>([]);
const roles = ref<AdminRole[]>([]);
const assignments = ref<Record<number, number[]>>({});
const actionError = ref('');
const lookupError = ref('');
const acting = ref(false);
const formOpen = ref(false);
const createOpen = ref(false);
const invitePanel = ref<InstanceType<typeof InvitePanel>>();
const editing = ref<AdminUser>();
const assigning = ref<AdminUser>();
const resetUser = ref<AdminUser>();
const password = ref('');
const resetError = ref('');
const link = ref('');
let roleSequence = 0;
const statusLabels: Record<UserStatus, string> = {
  active: '启用',
  disabled: '禁用',
  locked: '锁定',
};
const statusColors: Record<UserStatus, string> = {
  active: 'success',
  disabled: 'default',
  locked: 'warning',
};
const statusOptions = Object.entries(statusLabels).map(([value, label]) => ({
  label,
  value,
}));
const columns = [
  { dataIndex: 'username', title: '用户名', width: 150 },
  { dataIndex: 'nickname', title: '昵称', width: 140 },
  { dataIndex: 'email', title: '邮箱', width: 180 },
  { dataIndex: 'dept_id', title: '部门', width: 130 },
  { dataIndex: 'roles', title: '角色', width: 190 },
  { dataIndex: 'status', title: '状态', width: 90 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'actions', title: '操作', width: 360 },
];
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  pageSizeOptions: ['10', '20', '50', '100'],
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
  total: total.value,
}));
async function loadAssignments() {
  const sequence = ++roleSequence;
  const results = await Promise.allSettled(
    users.value.map(
      async (user) => [user.id, await getUserRolesApi(user.id)] as const,
    ),
  );
  if (sequence !== roleSequence) return;
  assignments.value = Object.fromEntries(
    results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    ),
  );
}
async function refresh() {
  await load();
  await loadAssignments();
}
async function loadLookups() {
  lookupError.value = '';
  const results = await Promise.allSettled([
    getDepartmentsApi(),
    hasPermission('system:role:list') ? getAllRolesApi() : Promise.resolve([]),
  ]);
  if (results[0].status === 'fulfilled') departments.value = results[0].value;
  if (results[1].status === 'fulfilled') roles.value = results[1].value;
  for (const result of results)
    if (result.status === 'rejected')
      lookupError.value = toApiError(result.reason).message;
}
async function edit(user?: AdminUser) {
  actionError.value = '';
  acting.value = true;
  try {
    editing.value = user ? await getUserApi(user.id) : undefined;
    formOpen.value = true;
  } catch (error_) {
    actionError.value = toApiError(error_).message;
  } finally {
    acting.value = false;
  }
}
async function saved() {
  formOpen.value = false;
  assigning.value = undefined;
  await refresh();
  message.success('用户信息已更新');
}
function confirmAction(
  user: AdminUser,
  action: 'delete' | 'status' | 'unlock',
) {
  if (
    acting.value ||
    (action === 'unlock' &&
      (user.status !== 'locked' || !hasPermission('system:user:update')))
  )
    return;
  let title = `${user.status === 'disabled' ? '启用' : '禁用'}用户 ${user.username}？`;
  let content = '禁用后该用户将无法登录。';
  if (action === 'delete') {
    title = `删除用户 ${user.username}？`;
    content = '删除后无法恢复，请确认该用户已无需使用。';
  } else if (action === 'unlock') {
    title = `解锁用户 ${user.username}？`;
    content = '解锁后该用户可立即尝试登录';
  }
  Modal.confirm({
    title,
    content,
    okType: action === 'delete' ? 'danger' : 'primary',
    async onOk() {
      if (acting.value) return;
      acting.value = true;
      actionError.value = '';
      try {
        if (action === 'delete') await deleteUserApi(user.id);
        else if (action === 'unlock') {
          const updated = await unlockUserApi(user.id);
          users.value = users.value.map((row) =>
            row.id === updated.id ? updated : row,
          );
        } else {
          const latest = await getUserApi(user.id);
          await updateUserApi(user.id, {
            avatar: latest.avatar,
            dept_id: latest.dept_id,
            email: latest.email,
            nickname: latest.nickname,
            status: latest.status === 'disabled' ? 'active' : 'disabled',
          });
        }
        if (action === 'delete' && users.value.length === 1 && page.value > 1)
          page.value--;
        await refresh();
        message.success(action === 'unlock' ? '用户已解锁' : '操作成功');
      } catch (error_) {
        const failure = toApiError(error_);
        actionError.value =
          action === 'unlock' && failure.status === 409
            ? '该用户已禁用，无法解锁，请刷新列表'
            : failure.message;
        if (action === 'unlock' && failure.status === 409) await refresh();
      } finally {
        acting.value = false;
      }
    },
  });
}
async function resetLink(user: AdminUser) {
  acting.value = true;
  actionError.value = '';
  try {
    const result = await createResetLinkApi(user.id);
    link.value = frontendAccountLink(result.link, window.location.origin);
    await refresh();
  } catch (error_) {
    actionError.value = toApiError(error_).message;
  } finally {
    acting.value = false;
  }
}
async function resetPassword() {
  resetError.value = passwordError(password.value);
  if (resetError.value || !resetUser.value) return;
  acting.value = true;
  try {
    await resetUserPasswordApi(resetUser.value.id, password.value);
    resetUser.value = undefined;
    password.value = '';
    await refresh();
    message.success('密码已重置，用户需本人修改密码');
  } catch (error_) {
    resetError.value = toApiError(error_).message;
  } finally {
    acting.value = false;
  }
}
async function handleTableChange(value: {
  current?: number;
  pageSize?: number;
}) {
  await changePage(value.current ?? 1, value.pageSize ?? pageSize.value);
  await loadAssignments();
}
async function handleSearch() {
  await search();
  await loadAssignments();
}
async function handleReset() {
  await reset();
  await loadAssignments();
}
onMounted(() => {
  void refresh();
  void loadLookups();
});
onUnmounted(() => {
  dispose();
  roleSequence++;
});
</script>

<template>
  <Page title="用户管理" description="管理用户信息、部门、角色与账号安全。">
    <Card title="用户列表">
      <template #extra>
        <Button
          v-if="hasPermission('system:user:create')"
          type="primary"
          :disabled="acting || !departments.length"
          @click="createOpen = true"
        >
          新增用户
        </Button>
      </template>
      <form
        class="mb-4 flex flex-wrap items-center gap-3"
        @submit.prevent="handleSearch"
      >
        <label for="user-keyword">关键词</label>
        <Input
          id="user-keyword"
          v-model:value="keyword"
          class="!w-60"
          allow-clear
          placeholder="用户名、昵称或邮箱"
        />
        <label for="user-status">状态</label>
        <Select
          id="user-status"
          v-model:value="status"
          class="!w-36"
          :options="statusOptions"
          allow-clear
          placeholder="全部状态"
        />
        <Space>
          <Button type="primary" html-type="submit" :loading="loading">
            查询
          </Button>
          <Button :disabled="loading" @click="handleReset">重置</Button>
        </Space>
      </form>
      <Alert
        v-if="error || actionError"
        class="mb-4"
        type="error"
        show-icon
        :message="error || actionError"
      >
        <template #action>
          <Button size="small" @click="refresh">重试</Button>
        </template>
      </Alert>
      <Alert
        v-if="lookupError"
        class="mb-4"
        type="warning"
        show-icon
        :message="`部门或角色加载失败：${lookupError}`"
      >
        <template #action>
          <Button size="small" @click="loadLookups">重试</Button>
        </template>
      </Alert>
      <Table
        :columns="columns"
        :data-source="users"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1520 }"
        row-key="id"
        data-testid="user-table"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <Tag
            v-if="column.dataIndex === 'status'"
            :color="statusColors[record.status as UserStatus]"
          >
            {{ statusLabels[record.status as UserStatus] || '未知' }}
          </Tag>
          <template v-else-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(text) }}
          </template>
          <template v-else-if="column.dataIndex === 'dept_id'">
            {{ nodeLabel(departments, text) || `部门 #${text}` }}
          </template>
          <template v-else-if="column.dataIndex === 'roles'">
            <span v-if="!assignments[record.id]">角色读取中或不可用</span>
            <span v-else-if="assignments[record.id]?.length === 0">未分配</span>
            <Tag v-for="id in assignments[record.id]" :key="id">
              {{ roles.find((role) => role.id === id)?.name || `角色 #${id}` }}
            </Tag>
          </template>
          <Space v-else-if="column.dataIndex === 'actions'" wrap>
            <Button
              v-if="hasPermission('system:user:update')"
              size="small"
              :disabled="acting || !departments.length"
              @click="edit(record as AdminUser)"
            >
              编辑
            </Button>
            <Button
              v-if="hasPermission('system:user:grant')"
              size="small"
              :disabled="acting || !roles.length"
              @click="assigning = record as AdminUser"
            >
              分配角色
            </Button>
            <Button
              v-if="hasPermission('system:user:reset')"
              size="small"
              :disabled="acting"
              @click="resetLink(record as AdminUser)"
            >
              生成重置链接
            </Button>
            <Button
              v-if="hasPermission('system:user:reset')"
              size="small"
              :disabled="acting"
              @click="
                resetUser = record as AdminUser;
                password = '';
                resetError = '';
              "
            >
              重置密码
            </Button>
            <Button
              v-if="hasPermission('system:user:update')"
              size="small"
              :disabled="acting"
              @click="confirmAction(record as AdminUser, 'status')"
            >
              {{ record.status === 'disabled' ? '启用' : '禁用' }}
            </Button>
            <Button
              v-if="
                record.status === 'locked' &&
                hasPermission('system:user:update')
              "
              size="small"
              :disabled="acting"
              @click="confirmAction(record as AdminUser, 'unlock')"
            >
              解锁
            </Button>
            <Button
              v-if="hasPermission('system:user:delete')"
              size="small"
              danger
              :disabled="acting"
              @click="confirmAction(record as AdminUser, 'delete')"
            >
              删除
            </Button>
          </Space>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <InvitePanel
      ref="invitePanel"
      :departments="departments"
      :roles="roles"
      @changed="refresh"
    />
    <Modal
      :open="createOpen"
      title="新增用户"
      :footer="null"
      @cancel="createOpen = false"
    >
      <Space direction="vertical" class="w-full">
        <Button
          type="primary"
          block
          @click="
            createOpen = false;
            invitePanel?.openCreate();
          "
        >
          邀请新同事（推荐）
        </Button>
        <Button
          block
          @click="
            createOpen = false;
            edit();
          "
        >
          直接建号
        </Button>
      </Space>
    </Modal>
    <UserForm
      v-if="formOpen"
      :user="editing"
      :departments="departments"
      @close="formOpen = false"
      @saved="saved"
    />
    <UserRoles
      v-if="assigning"
      :user="assigning"
      :roles="roles"
      @close="assigning = undefined"
      @saved="saved"
    />
    <LinkModal
      :open="Boolean(link)"
      title="一次性重置链接"
      :link="link"
      description="链接有效期 30 分钟，只能使用 1 次。对方的密码由本人设置，你无法看到。"
      @close="link = ''"
    />
    <Modal
      :open="Boolean(resetUser)"
      title="重置密码"
      :confirm-loading="acting"
      :cancel-button-props="{ disabled: acting }"
      :closable="!acting"
      :mask-closable="false"
      @ok="resetPassword"
      @cancel="
        resetUser = undefined;
        password = '';
      "
    >
      <Alert
        message="该操作会使用户会话失效，并标记需要本人修改密码。"
        type="warning"
        class="mb-4"
      />
      <Alert
        v-if="resetError"
        :message="resetError"
        type="error"
        class="mb-4"
      />
      <Input.Password
        v-model:value="password"
        aria-label="新密码"
        placeholder="至少 8 个字符，包含字母与数字"
        autocomplete="new-password"
      />
    </Modal>
  </Page>
</template>
