<script setup lang="ts">
import type { Dayjs } from 'dayjs';

import type { LogFilters } from './log-filters';

import { computed } from 'vue';

import { Button, DatePicker, Input, InputNumber, Select } from 'ant-design-vue';

import { logResults } from './log-filters';

const props = defineProps<{
  filters: LogFilters;
  kind: 'audit' | 'login';
  loading: boolean;
}>();
const emit = defineEmits<{
  search: [];
  reset: [];
  refresh: [];
  update: [value: Partial<LogFilters>];
}>();
const action = computed({
  get: () => props.filters.action,
  set: (value: string) => emit('update', { action: value }),
});
const resourceType = computed({
  get: () => props.filters.resourceType,
  set: (value: string) => emit('update', { resourceType: value }),
});
const result = computed({
  get: () => props.filters.result,
  set: (value: LogFilters['result']) => emit('update', { result: value }),
});
const identity = computed({
  get: () => props.filters.identity ?? undefined,
  set: (value: number | string | undefined) => {
    emit('update', { identity: typeof value === 'number' ? value : undefined });
  },
});
const range = computed({
  get: () => props.filters.range ?? undefined,
  set: (value: [Dayjs, Dayjs] | undefined) => {
    emit('update', { range: value });
  },
});
</script>

<template>
  <form
    class="mb-4 flex flex-wrap items-center gap-3"
    aria-label="日志筛选"
    @submit.prevent="emit('search')"
  >
    <Input
      v-if="kind === 'audit'"
      v-model:value="action"
      aria-label="操作类型"
      placeholder="操作类型（如 identity.login）"
      :maxlength="128"
      allow-clear
      class="!w-64"
    />
    <Input
      v-if="kind === 'audit'"
      v-model:value="resourceType"
      aria-label="资源类型"
      placeholder="资源类型（如 user）"
      :maxlength="64"
      allow-clear
      class="!w-48"
    />
    <InputNumber
      v-model:value="identity"
      :aria-label="kind === 'audit' ? '操作者 ID' : '用户 ID'"
      :placeholder="kind === 'audit' ? '操作者 ID' : '用户 ID'"
      :min="1"
      :max="Number.MAX_SAFE_INTEGER"
      :precision="0"
      class="!w-40"
    />
    <Select
      v-model:value="result"
      aria-label="结果"
      placeholder="全部结果"
      allow-clear
      class="!w-32"
      :options="logResults"
    />
    <DatePicker.RangePicker
      v-model:value="range"
      :input-read-only="false"
      :placeholder="['开始时间', '结束时间']"
      show-time
      format="YYYY-MM-DD HH:mm:ss"
      class="!w-[390px]"
      :allow-clear="true"
    />
    <Button type="primary" html-type="submit" :loading="loading">查询</Button>
    <Button :disabled="loading" @click="emit('reset')">清空筛选</Button>
    <Button :disabled="loading" @click="emit('refresh')">刷新</Button>
    <span class="w-full text-xs text-gray-500">
      时间按本地时区显示，筛选包含开始与结束时间。
    </span>
  </form>
</template>
