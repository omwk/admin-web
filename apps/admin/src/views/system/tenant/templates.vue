<script setup lang="ts">
import type { Tenant, TenantTemplate } from '#/api/model/tenant';

import { computed, ref } from 'vue';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Space,
  Table,
  Tabs,
  Tooltip,
} from 'ant-design-vue';

import {
  deleteTenantTemplateApi,
  getTenantTemplateApi,
} from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants } from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';

import TemplateForm from './template-form.vue';

const props = defineProps<{
  templates: TenantTemplate[];
  tenants: Tenant[];
  loading: boolean;
  usageKnown: boolean;
}>();
const emit = defineEmits<{ changed: [] }>();
const form = ref(false);
const editing = ref<TenantTemplate>();
const detail = ref<TenantTemplate>();
const deleting = ref<TenantTemplate>();
const busy = ref(false);
const error = ref('');
const deleteError = ref('');
const used = computed(
  () => new Set(props.tenants.map((tenant) => tenant.provisioned_from)),
);
const columns = [
  { dataIndex: 'code', title: 'Code' },
  { dataIndex: 'name', title: '名称' },
  { dataIndex: 'roles', title: '角色数', width: 90 },
  { dataIndex: 'menus', title: '菜单数', width: 90 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'actions', title: '操作', width: 240 },
];
function reason(id: number) {
  if (!props.usageKnown) return '租户引用信息未加载，暂不可删除';
  return used.value.has(id) ? '模板已被租户使用，不可删除' : '';
}
function create() {
  editing.value = undefined;
  form.value = true;
}
function saved() {
  form.value = false;
  message.success(editing.value ? '模板已保存' : '模板快照已生成');
  emit('changed');
}
async function showDetail(id: number) {
  if (busy.value) return;
  busy.value = true;
  error.value = '';
  try {
    detail.value = await getTenantTemplateApi(id);
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
async function remove() {
  if (!deleting.value || busy.value || props.loading || !canManageTenants())
    return;
  deleteError.value = reason(deleting.value.id);
  if (deleteError.value) return;
  busy.value = true;
  try {
    await deleteTenantTemplateApi(deleting.value.id);
    deleting.value = undefined;
    message.success('模板已删除');
    emit('changed');
  } catch (error_) {
    deleteError.value = toApiError(error_).message;
    emit('changed');
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Card title="租户模板">
    <template #extra>
      <Space>
        <Button :disabled="busy || loading" @click="emit('changed')">
          刷新模板
        </Button>
        <Button
          v-if="canManageTenants()"
          type="primary"
          :disabled="loading || busy || !usageKnown"
          @click="create"
        >
          生成模板
        </Button>
      </Space>
    </template>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Alert
      v-if="!usageKnown && !loading"
      message="无法确认租户引用情况，请刷新后再生成或删除模板。"
      type="warning"
      class="mb-4"
    />
    <Table
      data-testid="tenant-template-table"
      :columns="columns"
      :data-source="templates"
      :loading="loading"
      :scroll="{ x: 1000 }"
      row-key="id"
      :pagination="{ pageSize: 20 }"
    >
      <template #emptyText>
        <Empty description="暂无租户模板，请从现有租户生成快照。" />
      </template>
      <template #bodyCell="{ column, record, text }">
        <template
          v-if="column.dataIndex === 'roles' || column.dataIndex === 'menus'"
        >
          {{ text.length }}
        </template>
        <template v-else-if="column.dataIndex === 'created_at'">
          {{ formatDateTime(text) }}
        </template>
        <Space v-else-if="column.dataIndex === 'actions'">
          <Button
            size="small"
            :disabled="loading || busy"
            @click="showDetail(record.id)"
          >
            查看快照
          </Button>
          <template v-if="canManageTenants()">
            <Button
              size="small"
              :disabled="loading || busy"
              @click="
                editing = record as TenantTemplate;
                form = true;
              "
            >
              编辑模板
            </Button>
            <Tooltip :title="reason(record.id)">
              <span class="inline-flex">
                <Button
                  size="small"
                  danger
                  :disabled="loading || busy || Boolean(reason(record.id))"
                  @click="
                    deleting = record as TenantTemplate;
                    deleteError = '';
                  "
                >
                  删除模板
                </Button>
              </span>
            </Tooltip>
          </template>
        </Space>
      </template>
    </Table>
    <TemplateForm
      v-if="form && canManageTenants()"
      :tenants="tenants"
      :template="editing"
      @close="form = false"
      @saved="saved"
    />
    <Modal
      v-if="deleting"
      :open="true"
      :title="`删除模板「${deleting.name}」？`"
      ok-text="确认删除"
      cancel-text="取消"
      ok-type="danger"
      :confirm-loading="busy"
      :cancel-button-props="{ disabled: busy }"
      :closable="!busy"
      :keyboard="!busy"
      :mask-closable="false"
      @ok="remove"
      @cancel="deleting = undefined"
    >
      <Alert
        v-if="deleteError"
        :message="deleteError"
        type="error"
        show-icon
        class="mb-4"
      />
      <p>删除后无法恢复。被租户使用的模板不可删除。</p>
    </Modal>
    <Modal
      v-if="detail"
      :open="true"
      :title="`模板快照：${detail.name}`"
      :footer="null"
      :width="800"
      @cancel="detail = undefined"
    >
      <p>{{ detail.description || '无描述' }}</p>
      <Tabs>
        <Tabs.TabPane key="roles" :tab="`角色（${detail.roles.length}）`">
          <Table
            size="small"
            :data-source="detail.roles"
            :columns="[
              { dataIndex: 'code', title: 'Code' },
              { dataIndex: 'name', title: '名称' },
              { dataIndex: 'data_scope', title: '数据范围' },
            ]"
            row-key="code"
          />
        </Tabs.TabPane>
        <Tabs.TabPane key="menus" :tab="`菜单（${detail.menus.length}）`">
          <Table
            size="small"
            :data-source="detail.menus"
            :columns="[
              { dataIndex: 'name', title: '名称' },
              { dataIndex: 'path', title: '路径' },
              { dataIndex: 'type', title: '类型' },
            ]"
            row-key="key"
          />
        </Tabs.TabPane>
        <Tabs.TabPane
          key="permissions"
          :tab="`权限（${detail.permissions.length}）`"
        >
          <Table
            size="small"
            :data-source="detail.permissions"
            :columns="[
              { dataIndex: 'code', title: '权限码' },
              { dataIndex: 'name', title: '名称' },
            ]"
            row-key="code"
          />
        </Tabs.TabPane>
      </Tabs>
    </Modal>
  </Card>
</template>
