<script setup lang="ts">
import type { Tenant, TenantMember } from '#/api/model/tenant';

import { onUnmounted, ref, watch } from 'vue';

import { Alert, Button, Drawer, Table, Tag } from 'ant-design-vue';

import { getTenantMembersApi } from '#/api/core/tenants';
import { toApiError } from '#/api/errors';
import { useMetaDictionary } from '#/composables/use-meta-dictionary';
import { formatDateTime } from '#/utils/datetime';

const props = defineProps<{ tenant: Tenant }>();
const emit = defineEmits<{ close: [] }>();
const dictionary = useMetaDictionary('user_status');
const members = ref<TenantMember[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const error = ref('');
let sequence = 0;
const columns = [
  { dataIndex: 'account', title: '账号', width: 200 },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'is_super', title: '超管', width: 80 },
  { dataIndex: 'created_at', title: '创建时间', width: 180 },
];
async function load(value = page.value) {
  const current = ++sequence;
  page.value = value;
  loading.value = true;
  error.value = '';
  members.value = [];
  try {
    const result = await getTenantMembersApi(props.tenant.id, value);
    if (current !== sequence) return;
    members.value = result.list;
    total.value = result.total;
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
watch(
  () => props.tenant.id,
  () => {
    total.value = 0;
    void load(1);
  },
  { immediate: true },
);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Drawer
    :open="true"
    :title="`${tenant.name} · 成员`"
    placement="right"
    :width="760"
    @close="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template #action>
        <Button size="small" :disabled="loading" @click="load()"> 重试 </Button>
      </template>
    </Alert>
    <Alert
      v-if="dictionary.error.value"
      :message="dictionary.error.value"
      type="error"
      show-icon
      class="mb-4"
    />
    <Table
      data-testid="tenant-member-table"
      :columns="columns"
      :data-source="members"
      :loading="loading"
      :pagination="{
        current: page,
        pageSize: 20,
        total,
        showSizeChanger: false,
        showTotal: (count: number) => `共 ${count} 位成员`,
        onChange: (value: number) => load(value),
      }"
      :locale="{ emptyText: '暂无成员' }"
      :scroll="{ x: 600 }"
      row-key="id"
    >
      <template #bodyCell="{ column, record, text }">
        <Tag
          v-if="column.dataIndex === 'status'"
          :color="dictionary.color(record.status)"
        >
          {{ dictionary.label(record.status) }}
        </Tag>
        <template v-else-if="column.dataIndex === 'is_super'">
          {{ text ? '是' : '否' }}
        </template>
        <template v-else-if="column.dataIndex === 'created_at'">
          {{ formatDateTime(text) }}
        </template>
      </template>
    </Table>
  </Drawer>
</template>
