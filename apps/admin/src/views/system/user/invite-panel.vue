<script setup lang="ts">
import type { Invite } from '#/api/model/invite';
import type { AdminRole, Department } from '#/api/model/system';

import { computed, onMounted, onUnmounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Card,
  Form,
  InputNumber,
  message,
  Modal,
  Select,
  Table,
  Tag,
  TreeSelect,
} from 'ant-design-vue';
import dayjs from 'dayjs';

import {
  createInviteApi,
  getInvitesApi,
  revokeInviteApi,
} from '#/api/core/invites';
import { toApiError } from '#/api/errors';
import { frontendAccountLink } from '#/auth/account-link';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';

import LinkModal from '../shared/link-modal.vue';
import { nodeLabel, treeOptions } from '../shared/tree';

const props = defineProps<{ departments: Department[]; roles: AdminRole[] }>();
const emit = defineEmits<{ changed: [] }>();
const invites = ref<Invite[]>([]);
const loading = ref(false);
const busy = ref(false);
const error = ref('');
const formError = ref('');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const open = ref(false);
const link = ref('');
const description = ref('');
const form = reactive({
  days: 7,
  dept_id: undefined as number | undefined,
  max_uses: 1,
  role_ids: [] as number[],
});
const departments = computed(() => treeOptions(props.departments));
let sequence = 0;
const labels = {
  active: '有效',
  expired: '已过期',
  revoked: '已撤销',
  used: '已用完',
};
const columns = [
  { dataIndex: 'id', title: '邀请 ID', width: 100 },
  { dataIndex: 'dept_id', title: '预置部门', width: 140 },
  { dataIndex: 'role_ids', title: '预置角色', width: 200 },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'usage', title: '已用 / 可用次数', width: 140 },
  { dataIndex: 'expires_at', title: '过期时间', width: 180 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'actions', title: '操作', width: 100 },
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
    const result = await getInvitesApi(page.value, pageSize.value);
    if (current !== sequence) return;
    invites.value = result.list;
    total.value = result.total;
  } catch (error_) {
    if (current === sequence) {
      error.value = toApiError(error_).message;
      invites.value = [];
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}
function openCreate() {
  Object.assign(form, {
    days: 7,
    dept_id: undefined,
    max_uses: 1,
    role_ids: [],
  });
  formError.value = '';
  open.value = true;
}
async function create() {
  formError.value = '';
  if (
    !form.dept_id ||
    !Number.isInteger(form.days) ||
    form.days < 1 ||
    !Number.isInteger(form.max_uses) ||
    form.max_uses < 0
  ) {
    formError.value = '请选择部门并填写有效的天数与次数';
    return;
  }
  busy.value = true;
  try {
    const invite = await createInviteApi({
      dept_id: form.dept_id,
      role_ids: form.role_ids,
      expires_at: dayjs().add(form.days, 'day').toISOString(),
      max_uses: form.max_uses,
    });
    open.value = false;
    description.value = `链接有效期 ${form.days} 天，${form.max_uses === 0 ? '不限使用次数' : `只能使用 ${form.max_uses} 次`}。对方的密码由本人设置，你无法看到。链接仅本次显示，请及时复制。`;
    page.value = 1;
    await load();
    emit('changed');
    if (invite.link)
      link.value = frontendAccountLink(invite.link, window.location.origin);
    else error.value = '邀请已创建但未返回链接，请撤销后重新创建';
  } catch (error_) {
    formError.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
function revoke(invite: Invite) {
  Modal.confirm({
    title: `撤销邀请 #${invite.id}？`,
    content: '撤销后链接立即失效。',
    okType: 'danger',
    async onOk() {
      busy.value = true;
      error.value = '';
      try {
        await revokeInviteApi(invite.id);
        await load();
        emit('changed');
        message.success('邀请已撤销');
      } catch (error_) {
        error.value = toApiError(error_).message;
      } finally {
        busy.value = false;
      }
    },
  });
}
async function changePage(value: { current?: number; pageSize?: number }) {
  page.value = value.pageSize === pageSize.value ? (value.current ?? 1) : 1;
  pageSize.value = value.pageSize ?? 20;
  await load();
}
defineExpose({ openCreate });
onMounted(load);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Card title="邀请管理" class="mt-4">
    <template #extra>
      <Button
        v-if="hasPermission('system:user:create')"
        type="primary"
        :disabled="busy || !departments.length"
        @click="openCreate"
      >
        新建邀请
      </Button>
    </template>
    <Alert
      message="邀请人预置部门和角色，受邀人自行设置密码。链接仅在生成时显示。"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template #action>
        <Button size="small" @click="load">重试</Button>
      </template>
    </Alert>
    <Table
      data-testid="invite-table"
      :columns="columns"
      :data-source="invites"
      :pagination="pagination"
      :loading="loading"
      :scroll="{ x: 1180 }"
      row-key="id"
      @change="changePage"
    >
      <template #bodyCell="{ column, record, text }">
        <Tag
          v-if="column.dataIndex === 'status'"
          :color="record.status === 'active' ? 'success' : 'default'"
        >
          {{ labels[record.status as Invite['status']] }}
        </Tag>
        <template v-else-if="column.dataIndex === 'usage'">
          {{ record.used_count }} / {{ record.max_uses || '不限' }}
        </template>
        <template v-else-if="column.dataIndex === 'dept_id'">
          {{ nodeLabel(props.departments, text) || `部门 #${text}` }}
        </template>
        <template v-else-if="column.dataIndex === 'role_ids'">
          <Tag v-for="id in record.role_ids" :key="id">
            {{ roles.find((role) => role.id === id)?.name || `角色 #${id}` }}
          </Tag>
          <span v-if="record.role_ids.length === 0">未预置</span>
        </template>
        <template
          v-else-if="
            column.dataIndex === 'expires_at' ||
            column.dataIndex === 'created_at'
          "
        >
          {{ formatDateTime(text) }}
        </template>
        <Button
          v-else-if="
            column.dataIndex === 'actions' &&
            hasPermission('system:user:delete') &&
            record.status === 'active'
          "
          size="small"
          danger
          :disabled="busy"
          @click="revoke(record as Invite)"
        >
          撤销
        </Button>
      </template>
    </Table>
  </Card>
  <Modal
    :open="open"
    title="新建邀请"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="create"
    @cancel="open = false"
  >
    <Alert v-if="formError" :message="formError" type="error" class="mb-4" />
    <Form layout="vertical" :disabled="busy">
      <Form.Item label="预置部门" required>
        <TreeSelect
          v-model:value="form.dept_id"
          aria-label="预置部门"
          :tree-data="departments"
          tree-default-expand-all
          show-search
          tree-node-filter-prop="title"
        />
      </Form.Item>
      <Form.Item label="预置角色">
        <Select
          v-model:value="form.role_ids"
          mode="multiple"
          aria-label="预置角色"
          :options="
            roles.map((role) => ({
              label: role.name,
              value: role.id,
              disabled: role.status === 'disabled',
            }))
          "
          allow-clear
        />
      </Form.Item>
      <Form.Item label="有效期（天）" required>
        <InputNumber
          v-model:value="form.days"
          aria-label="有效期（天）"
          :min="1"
          :max="3650"
          :precision="0"
        />
      </Form.Item>
      <Form.Item label="最多使用次数（0 表示不限）" required>
        <InputNumber
          v-model:value="form.max_uses"
          aria-label="最多使用次数"
          :min="0"
          :precision="0"
        />
      </Form.Item>
    </Form>
  </Modal>
  <LinkModal
    :open="Boolean(link)"
    :link="link"
    title="邀请链接"
    :description="description"
    @close="link = ''"
  />
</template>
