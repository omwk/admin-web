<script setup lang="ts">
import type { Tenant, TenantTemplate } from '#/api/model/tenant';

import { computed, ref } from 'vue';
import { useRouter } from 'vue-router';

import {
  Alert,
  Button,
  Card,
  Empty,
  message,
  Modal,
  Space,
  Table,
  Tooltip,
} from 'ant-design-vue';

import { deleteTenantTemplateApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { canManageTenants } from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';

import { templatePermissionCount } from './template-editor-state';
import TemplateForm from './template-form.vue';

const props = defineProps<{
  templates: TenantTemplate[];
  tenants: Tenant[];
  loading: boolean;
  usageKnown: boolean;
}>();
const emit = defineEmits<{ changed: [] }>();
const router = useRouter();
const form = ref<'blank' | 'clone' | 'snapshot'>();
const copying = ref<TenantTemplate>();
const deleting = ref<TenantTemplate>();
const busy = ref(false);
const deleteError = ref('');
const usage = computed(() => {
  const counts = new Map<number, number>();
  for (const tenant of props.tenants) {
    if (tenant.provisioned_from !== null)
      counts.set(
        tenant.provisioned_from,
        (counts.get(tenant.provisioned_from) ?? 0) + 1,
      );
  }
  return counts;
});
const columns = [
  { dataIndex: 'name', title: '名称' },
  { dataIndex: 'code', title: 'Code' },
  { dataIndex: 'roles', title: '角色数', width: 90 },
  { dataIndex: 'permissions', title: '权限数', width: 90 },
  { dataIndex: 'usage', title: '使用中', width: 90 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  { dataIndex: 'actions', title: '操作', width: 260 },
];
function reason(id: number) {
  if (!props.usageKnown) return '租户引用信息未加载，暂不可删除';
  return usage.value.has(id) ? '模板已被租户使用，不可删除' : '';
}
function saved(template: TenantTemplate) {
  form.value = undefined;
  message.success('模板已创建');
  emit('changed');
  void router.push(`/system/tenants/templates/${template.id}`);
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
      <Space wrap>
        <Button :disabled="busy || loading" @click="emit('changed')">
          刷新模板
        </Button>
        <template v-if="canManageTenants()">
          <Button
            :disabled="loading || busy || !usageKnown"
            @click="form = 'snapshot'"
          >
            从租户创建
          </Button>
          <Button
            type="primary"
            :disabled="loading || busy"
            @click="form = 'blank'"
          >
            新建空白模板
          </Button>
        </template>
      </Space>
    </template>
    <Alert
      v-if="!usageKnown && !loading"
      message="无法确认租户引用情况，请刷新后再从租户创建或删除模板。"
      type="warning"
      class="mb-4"
    />
    <Table
      data-testid="tenant-template-table"
      :columns="columns"
      :data-source="templates"
      :loading="loading"
      :scroll="{ x: 1100 }"
      row-key="id"
      :pagination="{ pageSize: 20 }"
    >
      <template #emptyText>
        <Empty description="暂无租户模板，可从租户创建快照或新建空白模板。" />
      </template>
      <template #bodyCell="{ column, record, text }">
        <template v-if="column.dataIndex === 'roles'">
          {{ text.length }} 个
        </template>
        <template v-else-if="column.dataIndex === 'permissions'">
          {{ templatePermissionCount(record as TenantTemplate) }} 个
        </template>
        <template v-else-if="column.dataIndex === 'usage'">
          {{ usageKnown ? `${usage.get(record.id) ?? 0} 个租户` : '未知' }}
        </template>
        <template v-else-if="column.dataIndex === 'created_at'">
          {{ formatDateTime(text) }}
        </template>
        <Space v-else-if="column.dataIndex === 'actions' && canManageTenants()">
          <Button
            size="small"
            :disabled="loading || busy"
            @click="router.push(`/system/tenants/templates/${record.id}`)"
          >
            编辑模板
          </Button>
          <Button
            size="small"
            :disabled="loading || busy"
            @click="
              copying = record as TenantTemplate;
              form = 'clone';
            "
          >
            复制模板
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
        </Space>
      </template>
    </Table>
    <TemplateForm
      v-if="form && canManageTenants()"
      :mode="form"
      :tenants="tenants"
      :template="form === 'clone' ? copying : undefined"
      @close="form = undefined"
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
  </Card>
</template>
