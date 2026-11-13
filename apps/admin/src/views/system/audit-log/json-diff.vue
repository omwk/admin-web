<script setup lang="ts">
import type { JsonValue } from '#/api/model/audit';

import { computed } from 'vue';

import { Tag, Tree } from 'ant-design-vue';

import { diffTrees } from './json-diff';

const props = defineProps<{ before: JsonValue; after: JsonValue }>();
const trees = computed(() => diffTrees(props.before, props.after));
const changes = {
  added: { color: 'success', label: '新增' },
  changed: { color: 'warning', label: '修改' },
  removed: { color: 'error', label: '移除' },
};
</script>

<template>
  <div class="grid gap-4 p-3 lg:grid-cols-2" data-testid="audit-diff">
    <section
      v-for="side in ['before', 'after'] as const"
      :key="side"
      :aria-label="side"
      class="min-w-0 rounded border p-3"
    >
      <h3 class="mb-3 font-semibold">
        {{ side === 'before' ? 'before · 变更前' : 'after · 变更后' }}
      </h3>
      <Tree
        :tree-data="trees[side]"
        default-expand-all
        :selectable="false"
        block-node
      >
        <template #title="node">
          <span class="whitespace-pre-wrap break-all font-mono text-xs">{{
            node.title
          }}</span>
          <Tag
            v-if="node.change !== 'same'"
            :color="changes[node.change as keyof typeof changes].color"
            class="ml-2"
          >
            {{ changes[node.change as keyof typeof changes].label }}
          </Tag>
        </template>
      </Tree>
    </section>
  </div>
</template>
