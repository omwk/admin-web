<script setup lang="ts">
import type { Tenant, TenantTemplate } from '#/api/model/tenant';

import { computed, onDeactivated, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Space, Table, Tabs, Tag } from 'ant-design-vue';

import { getAllTenantsApi, getAllTenantTemplatesApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import {
  canManageTenants,
  canViewTenants,
  platformTenantId,
} from '#/auth/tenant';
import { formatDateTime } from '#/utils/datetime';
import Forbidden from '#/views/_core/fallback/forbidden.vue';

import MemberDrawer from './member-drawer.vue';
import ProvisionWizard from './provision-wizard.vue';
import Templates from './templates.vue';
import TenantActions from './tenant-actions.vue';

defineOptions({ name: 'SystemTenantList' });
const tenants = ref<Tenant[]>([]);
const templates = ref<TenantTemplate[]>([]);
const loading = ref(false);
const acting = ref(false);
const error = ref('');
const templateError = ref('');
const tab = ref('tenants');
const wizard = ref(false);
const usageKnown = ref(false);
const page = ref(1);
const selectedTenant = ref<Tenant>();
let sequence = 0;
const columns = computed(() => [
  { dataIndex: 'id', title: 'ID', width: 80 },
  { dataIndex: 'code', title: 'Code', width: 180 },
  { dataIndex: 'name', title: '名称', width: 200 },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'admin_active_count', title: '管理员', width: 110 },
  { dataIndex: 'provisioned_from', title: '来源模板', width: 180 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
  {
    dataIndex: 'actions',
    title: '操作',
    width: canManageTenants() ? 450 : 120,
  },
]);
async function load() {
  if (!canViewTenants()) return;
  const current = ++sequence;
  loading.value = true;
  usageKnown.value = false;
  error.value = '';
  templateError.value = '';
  const [directory, snapshots] = await Promise.allSettled([
    getAllTenantsApi(),
    canManageTenants() ? getAllTenantTemplatesApi() : Promise.resolve([]),
  ]);
  if (current !== sequence) return;
  if (directory.status === 'fulfilled') {
    tenants.value = directory.value;
    usageKnown.value = true;
  } else {
    tenants.value = [];
    error.value = toApiError(directory.reason).message;
  }
  if (snapshots.status === 'fulfilled') {
    templates.value = snapshots.value;
  } else {
    templates.value = [];
    templateError.value = toApiError(snapshots.reason).message;
  }
  loading.value = false;
}
function templateName(id: null | number) {
  if (id === null) return '无';
  return templates.value.find((item) => item.id === id)?.name ?? `模板 #${id}`;
}
function manageTemplates() {
  wizard.value = false;
  tab.value = 'templates';
}
onMounted(load);
onDeactivated(() => {
  selectedTenant.value = undefined;
});
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Forbidden v-if="!canViewTenants()" />
  <Page
    v-else
    title="租户管理"
    description="管理租户状态，按模板开通并邀请管理员自行设置密码。"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Alert
      v-if="templateError"
      :message="templateError"
      type="error"
      show-icon
      class="mb-4"
    />
    <Tabs v-model:active-key="tab">
      <Tabs.TabPane key="tenants" tab="租户列表">
        <Card title="租户列表">
          <template #extra>
            <Space>
              <Button :disabled="loading || acting" @click="load">刷新</Button>
              <Button
                v-if="canManageTenants()"
                type="primary"
                :disabled="loading || acting || Boolean(templateError)"
                @click="wizard = true"
              >
                开通租户
              </Button>
            </Space>
          </template>
          <Table
            data-testid="tenant-table"
            :columns="columns"
            :data-source="tenants"
            :loading="loading"
            :pagination="{
              current: page,
              pageSize: 20,
              showTotal: (count: number) => `共 ${count} 个租户`,
              onChange: (value: number) => (page = value),
            }"
            :scroll="{ x: 1510 }"
            row-key="id"
          >
            <template #bodyCell="{ column, record, text }">
              <span v-if="column.dataIndex === 'id'" class="font-mono">{{
                text
              }}</span>
              <template v-else-if="column.dataIndex === 'code'">
                {{ text }}
                <Tag v-if="record.id === platformTenantId" color="blue">
                  平台
                </Tag>
              </template>
              <Tag
                v-else-if="column.dataIndex === 'status'"
                :color="record.status === 'active' ? 'success' : 'default'"
              >
                {{ record.status === 'active' ? '启用' : '停用' }}
              </Tag>
              <template v-else-if="column.dataIndex === 'admin_active_count'">
                <Tag v-if="text === 0" color="red">未激活</Tag>
                <span v-else>{{ text }} 人</span>
              </template>
              <template v-else-if="column.dataIndex === 'provisioned_from'">
                {{ templateName(record.provisioned_from) }}
              </template>
              <template v-else-if="column.dataIndex === 'created_at'">
                {{ formatDateTime(text) }}
              </template>
              <TenantActions
                v-else-if="column.dataIndex === 'actions'"
                :tenant="record as Tenant"
                :disabled="loading || acting"
                @busy="acting = $event"
                @changed="load"
                @members="selectedTenant = record as Tenant"
              />
            </template>
          </Table>
        </Card>
      </Tabs.TabPane>
      <Tabs.TabPane v-if="canManageTenants()" key="templates" tab="租户模板">
        <Templates
          :templates="templates"
          :tenants="tenants"
          :loading="loading"
          :usage-known="usageKnown"
          @changed="load"
        />
      </Tabs.TabPane>
    </Tabs>
    <MemberDrawer
      v-if="selectedTenant"
      :key="selectedTenant.id"
      :tenant="selectedTenant"
      @close="selectedTenant = undefined"
    />
    <ProvisionWizard
      v-if="wizard && canManageTenants()"
      :templates="templates"
      @close="wizard = false"
      @created="load"
      @templates="manageTemplates"
    />
  </Page>
</template>
