<script setup lang="ts">
import type { JsonValue } from '#/api/model/audit';

import { computed } from 'vue';

import { auditDiff } from './json-diff';

const props = defineProps<{ before: JsonValue; after: JsonValue }>();
const diff = computed(() => auditDiff(props.before, props.after));
const valueText = (value: JsonValue | undefined) =>
  value === undefined ? '—' : JSON.stringify(value, null, 2);
</script>

<template>
  <div
    class="overflow-x-auto p-3"
    data-testid="audit-diff"
    :data-shape="diff.kind"
  >
    <p v-if="diff.kind === 'empty'">—</p>
    <p v-else-if="diff.kind === 'unchanged'">无变化</p>
    <template v-else>
      <h3 class="mb-3 font-semibold">
        {{
          diff.kind === 'created'
            ? '新建'
            : diff.kind === 'deleted'
              ? '删除'
              : '变更字段'
        }}
      </h3>
      <table
        class="w-full border-collapse text-left text-sm"
        aria-label="审计字段"
      >
        <thead>
          <tr>
            <th class="border p-2">字段</th>
            <th v-if="diff.kind !== 'created'" class="border p-2">旧值</th>
            <th v-if="diff.kind !== 'deleted'" class="border p-2">新值</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="field in diff.fields" :key="field.key">
            <th scope="row" class="border p-2 font-mono font-normal">
              {{ field.field }}
            </th>
            <td
              v-if="diff.kind !== 'created'"
              class="whitespace-pre-wrap break-all border p-2 font-mono"
            >
              <del v-if="field.before !== undefined">
                <span>{{ valueText(field.before) }}</span>
              </del>
              <span v-else>—</span>
            </td>
            <td
              v-if="diff.kind !== 'deleted'"
              class="whitespace-pre-wrap break-all border p-2 font-mono"
            >
              <mark v-if="field.after !== undefined">
                <span
                  class="rounded bg-green-100 px-1 text-green-900 dark:bg-green-950 dark:text-green-100"
                >
                  {{ valueText(field.after) }}
                </span>
              </mark>
              <span v-else>—</span>
            </td>
          </tr>
        </tbody>
      </table>
    </template>
  </div>
</template>
