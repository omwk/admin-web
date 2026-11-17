<script setup lang="ts">
import type { Tenant } from '#/api/model/tenant';

import { Tag } from 'ant-design-vue';

import { formatDateTime } from '#/utils/datetime';

defineProps<{ tenant: Tenant }>();
</script>

<template>
  <template v-if="tenant.deleted_at">
    <Tag color="red">已归档</Tag>
    <span class="mt-1 block text-xs text-muted-foreground">
      归档时间：{{ formatDateTime(tenant.deleted_at) }}
    </span>
  </template>
  <Tag v-else-if="tenant.status === 'active'" color="green">正常</Tag>
  <Tag v-else color="default">已停用</Tag>
</template>
