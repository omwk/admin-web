<script setup lang="ts">
import type { DataScope, PermissionGroups } from '#/api/model/system';
import type { TenantTemplate, TenantTemplateRole } from '#/api/model/tenant';

import { computed } from 'vue';

import { Alert, Empty, Form, Input, Select, Tree } from 'ant-design-vue';

import PermissionGroupsView from '../role/permission-groups.vue';
import { dataScopeOptions } from '../role/role-options';
import {
  templateMenuTree,
  templatePermissionCodes,
  templatePermissionIds,
} from './template-editor-state';

const props = defineProps<{
  role: TenantTemplateRole;
  groups: PermissionGroups;
  menus: TenantTemplate['menus'];
  disabled: boolean;
}>();
const emit = defineEmits<{ 'update:role': [role: TenantTemplateRole] }>();
const selected = computed({
  get: () => templatePermissionIds(props.role.permissions, props.groups),
  set: (ids: number[]) =>
    update({
      permissions: templatePermissionCodes(
        props.role.permissions,
        ids,
        props.groups,
      ),
    }),
});
const tree = computed(() => templateMenuTree(props.menus));
function update(fields: Partial<TenantTemplateRole>) {
  emit('update:role', { ...props.role, ...fields });
}
</script>

<template>
  <div data-testid="template-role-panel">
    <Form layout="vertical" :disabled="disabled">
      <div class="grid gap-x-4 sm:grid-cols-3">
        <Form.Item label="角色名" required>
          <Input
            :value="role.name"
            aria-label="角色名"
            :maxlength="128"
            @update:value="update({ name: $event })"
          />
        </Form.Item>
        <Form.Item label="角色 Code" help="创建后不可修改">
          <Input :value="role.code" aria-label="角色 Code" disabled />
        </Form.Item>
        <Form.Item label="数据范围">
          <Select
            :value="role.data_scope"
            aria-label="数据范围"
            :options="dataScopeOptions"
            @update:value="update({ data_scope: $event as DataScope })"
          />
        </Form.Item>
      </div>
    </Form>
    <Alert
      v-if="role.permissions.length === 0"
      message="该角色尚未配置权限，保存时将再次提醒。"
      type="warning"
      show-icon
      class="mb-4"
    />
    <h3 class="mb-3 font-medium">权限配置</h3>
    <PermissionGroupsView
      :key="role.code"
      v-model:selected="selected"
      :groups="groups"
      :disabled="disabled"
    />
    <h3 class="mb-3 mt-6 font-medium">已选菜单（只读）</h3>
    <p class="mb-3 text-sm text-muted-foreground">
      菜单由模板框架提供，不允许编辑。菜单展示与接口权限独立；新增角色沿用模板菜单。
    </p>
    <div
      data-testid="template-readonly-menus"
      class="max-h-80 overflow-auto rounded border p-3"
    >
      <Tree
        v-if="tree.length"
        :key="role.code"
        :tree-data="tree"
        :checked-keys="role.menus"
        checkable
        check-strictly
        disabled
        :selectable="false"
        default-expand-all
      />
      <Empty v-else description="模板暂无菜单" />
    </div>
  </div>
</template>
