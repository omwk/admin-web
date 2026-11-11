<script setup lang="ts">
import type { PermissionGroups } from '#/api/model/system';

import { computed, ref, watch } from 'vue';

import { Checkbox, Collapse, Empty, Input } from 'ant-design-vue';

import {
  filteredPermissionGroups,
  togglePermissionGroup,
} from './permission-selection';

const props = defineProps<{
  disabled?: boolean;
  groups: PermissionGroups;
  selected: number[];
}>();
const emit = defineEmits<{ 'update:selected': [ids: number[]] }>();
const search = ref('');
const expanded = ref<string[]>([]);
const filtered = computed(() =>
  filteredPermissionGroups(props.groups, search.value),
);
const total = computed(() => Object.values(props.groups).flat().length);
const matches = computed(() =>
  filtered.value.reduce((count, group) => count + group.matches.length, 0),
);
const checkedCount = (module: string) =>
  props.groups[module]?.filter((permission) =>
    props.selected.includes(permission.id),
  ).length ?? 0;
function selectOne(id: number, checked: boolean) {
  emit(
    'update:selected',
    checked
      ? [...new Set([...props.selected, id])]
      : props.selected.filter((value) => value !== id),
  );
}
function resources(permissions: PermissionGroups[string]) {
  const result: Record<string, PermissionGroups[string]> = {};
  for (const permission of permissions) {
    const resource = permission.code.split(':').slice(1, -1).join(':');
    (result[resource] ??= []).push(permission);
  }
  return Object.entries(result);
}
watch(search, (value) => {
  expanded.value = value.trim()
    ? filtered.value.map((group) => group.module)
    : [];
});
</script>

<template>
  <div data-testid="permission-groups">
    <Input
      v-model:value="search"
      aria-label="搜索权限码"
      placeholder="按权限码、名称或模块搜索"
      allow-clear
      :disabled="disabled"
      class="mb-3"
    />
    <p class="mb-3 text-muted-foreground">
      共 {{ total }} 个权限码，已选 {{ selected.length }} 个，匹配
      {{ matches }} 个。模块全选包含搜索未显示的权限。
    </p>
    <Empty v-if="!filtered.length" description="没有匹配的权限" />
    <Collapse v-model:active-key="expanded">
      <Collapse.Panel
        v-for="group in filtered"
        :key="group.module"
        :header="`${group.module} (${group.permissions.length})`"
      >
        <template #extra>
          <span @click.stop @keydown.stop>
            <Checkbox
              :aria-label="`全选模块 ${group.module}`"
              :checked="checkedCount(group.module) === group.permissions.length"
              :indeterminate="
                checkedCount(group.module) > 0 &&
                checkedCount(group.module) < group.permissions.length
              "
              :disabled="disabled"
              @change="
                emit(
                  'update:selected',
                  togglePermissionGroup(
                    selected,
                    group.permissions,
                    $event.target.checked,
                  ),
                )
              "
            >
              全选模块
            </Checkbox>
          </span>
        </template>
        <div
          v-for="[resource, permissions] in resources(group.matches)"
          :key="resource"
          class="mb-4 last:mb-0"
        >
          <div class="mb-2 font-medium">{{ group.module }}:{{ resource }}</div>
          <div class="grid gap-3 sm:grid-cols-2">
            <Checkbox
              v-for="permission in permissions"
              :key="permission.id"
              :checked="selected.includes(permission.id)"
              :disabled="disabled"
              :aria-label="permission.code"
              class="!ms-0"
              @change="selectOne(permission.id, $event.target.checked)"
            >
              <span class="block">{{ permission.name }}</span>
              <code class="break-all text-xs text-muted-foreground">{{
                permission.code
              }}</code>
            </Checkbox>
          </div>
        </div>
      </Collapse.Panel>
    </Collapse>
  </div>
</template>
