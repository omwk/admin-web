<script setup lang="ts">
import type {
  AdminMenu,
  AdminRole,
  DataScope,
  Department,
  PermissionGroups,
} from '#/api/model/system';

import { computed, onMounted, ref } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  message,
  Select,
  Spin,
  Tabs,
  Tree,
} from 'ant-design-vue';

import {
  getAdminMenusApi,
  getDepartmentsApi,
  getPermissionsApi,
  getRoleApi,
  getRoleLinksApi,
  setRoleLinksApi,
  updateRoleApi,
} from '#/api/core/system';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import { treeOptions } from '../shared/tree';
import PermissionGroupsView from './permission-groups.vue';
import { menuGrantIds, menuLeafKeys } from './permission-selection';
import { dataScopeOptions } from './role-options';

const props = defineProps<{ role: AdminRole }>();
const emit = defineEmits<{ changed: []; close: [] }>();
const menus = ref<AdminMenu[]>([]);
const departments = ref<Department[]>([]);
const permissions = ref<PermissionGroups>({});
const menuIds = ref<number[]>([]);
const permissionIds = ref<number[]>([]);
const deptIds = ref<number[]>([]);
const scope = ref<DataScope>(props.role.data_scope);
const originalScope = ref<DataScope>(props.role.data_scope);
const loading = ref(false);
const ready = ref(false);
const saving = ref(false);
const error = ref('');
const active = ref('menus');
const menuTree = computed(() => treeOptions(menus.value, false));
const deptTree = computed(() => treeOptions(departments.value, false));
async function load() {
  loading.value = true;
  ready.value = false;
  error.value = '';
  try {
    const [
      tree,
      depts,
      groups,
      assignedMenus,
      assignedPermissions,
      assignedDepts,
      role,
    ] = await Promise.all([
      getAdminMenusApi(),
      getDepartmentsApi(),
      getPermissionsApi(),
      getRoleLinksApi(props.role.id, 'menus'),
      getRoleLinksApi(props.role.id, 'permissions'),
      getRoleLinksApi(props.role.id, 'depts'),
      getRoleApi(props.role.id),
    ]);
    menus.value = tree;
    departments.value = depts;
    permissions.value = groups;
    menuIds.value = menuLeafKeys(tree, assignedMenus);
    permissionIds.value = assignedPermissions;
    deptIds.value = assignedDepts;
    scope.value = role.data_scope;
    originalScope.value = role.data_scope;
    ready.value = true;
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    loading.value = false;
  }
}
type Keys =
  | (number | string)[]
  | { checked: (number | string)[]; halfChecked: (number | string)[] };
function checkMenus(keys: Keys) {
  menuIds.value = (Array.isArray(keys) ? keys : keys.checked).map(Number);
}
function checkDepartments(keys: Keys) {
  deptIds.value = (Array.isArray(keys) ? keys : keys.checked).map(Number);
}
async function save(relation: 'menus' | 'permissions' | 'scope') {
  saving.value = true;
  error.value = '';
  let partial = false;
  try {
    if (relation === 'scope') {
      if (scope.value === 'custom' && deptIds.value.length === 0) {
        error.value = '自定义范围请至少选择一个部门';
        return;
      }
      await setRoleLinksApi(
        props.role.id,
        'depts',
        scope.value === 'custom' ? deptIds.value : [],
      );
      partial = true;
      emit('changed');
      if (scope.value !== originalScope.value) {
        const latest = await getRoleApi(props.role.id);
        await updateRoleApi(props.role.id, {
          code: latest.code,
          name: latest.name,
          data_scope: scope.value,
          remark: latest.remark,
          status: latest.status,
        });
        originalScope.value = scope.value;
        emit('changed');
      }
    } else {
      const ids =
        relation === 'menus'
          ? menuGrantIds(menus.value, menuIds.value)
          : permissionIds.value;
      await setRoleLinksApi(props.role.id, relation, ids);
      partial = true;
      emit('changed');
    }
    message.success('授权已保存');
  } catch (error_) {
    error.value = `${partial ? '部分配置已保存，请检查后重试：' : ''}${toApiError(error_).message}`;
  } finally {
    saving.value = false;
  }
}
onMounted(load);
</script>

<template>
  <Drawer
    open
    :title="`角色授权 · ${role.name}`"
    :width="800"
    :closable="!saving"
    :mask-closable="!saving"
    destroy-on-close
    @close="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template v-if="!ready" #action>
        <Button size="small" @click="load">重试</Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Tabs v-if="ready" v-model:active-key="active">
        <Tabs.TabPane key="menus" tab="菜单">
          <Alert
            message="菜单与接口权限独立：勾选菜单不等于授予该菜单下的接口权限，请到「权限」页签单独授权。"
            type="warning"
            show-icon
            class="mb-4"
          />
          <Tree
            data-testid="role-menu-tree"
            :tree-data="menuTree"
            :checked-keys="menuIds"
            checkable
            default-expand-all
            :disabled="saving"
            @check="checkMenus"
          />
          <Button
            class="mt-4"
            type="primary"
            :loading="saving"
            @click="save('menus')"
          >
            保存菜单授权
          </Button>
        </Tabs.TabPane>
        <Tabs.TabPane key="permissions" tab="权限">
          <PermissionGroupsView
            v-model:selected="permissionIds"
            :groups="permissions"
            :disabled="saving"
          />
          <Button
            class="mt-4"
            type="primary"
            :loading="saving"
            @click="save('permissions')"
          >
            保存接口权限
          </Button>
        </Tabs.TabPane>
        <Tabs.TabPane key="scope" tab="数据范围">
          <label for="role-scope" class="mb-2 block">范围类型</label>
          <Select
            id="role-scope"
            v-model:value="scope"
            :options="dataScopeOptions"
            :disabled="saving || !hasPermission('system:role:update')"
            class="mb-4 w-full"
          />
          <Alert
            v-if="!hasPermission('system:role:update')"
            message="修改范围类型需要角色编辑权限。"
            type="info"
            class="mb-4"
          />
          <Tree
            v-if="scope === 'custom'"
            data-testid="role-dept-tree"
            :tree-data="deptTree"
            :checked-keys="deptIds"
            checkable
            check-strictly
            default-expand-all
            :disabled="saving"
            @check="checkDepartments"
          />
          <p v-else class="text-muted-foreground">
            范围根据用户所属部门和本人身份计算，无需额外选择部门。
          </p>
          <Button
            class="mt-4"
            type="primary"
            :loading="saving"
            @click="save('scope')"
          >
            保存数据范围
          </Button>
        </Tabs.TabPane>
      </Tabs>
    </Spin>
  </Drawer>
</template>
