<script setup lang="ts">
import type { AdminMenu, MenuInput } from '#/api/model/system';

import { computed, reactive, ref } from 'vue';

import {
  Alert,
  Form,
  Input,
  InputNumber,
  Modal,
  Select,
  Switch,
  TreeSelect,
} from 'ant-design-vue';

import { createAdminMenuApi, updateAdminMenuApi } from '#/api/core/system';
import { toApiError } from '#/api/errors';

import { menuParentOptions, menuTypes } from './menu-options';

const props = defineProps<{
  menu?: AdminMenu;
  menus: AdminMenu[];
  parentId: number;
}>();
const emit = defineEmits<{ close: []; saved: [] }>();
const form = reactive({
  parent_id: props.menu?.parent_id ?? props.parentId,
  name: props.menu?.name ?? '',
  type: props.menu?.type ?? ('menu' as AdminMenu['type']),
  path: props.menu?.path ?? '',
  component: props.menu?.component ?? '',
  icon: props.menu?.icon ?? '',
  permission_code: props.menu?.permission_code ?? '',
  sort: props.menu?.sort ?? 0,
  visible: props.menu?.visible ?? true,
  status: props.menu?.status ?? ('active' as MenuInput['status']),
  redirect: props.menu?.redirect ?? '',
  keep_alive: props.menu?.keep_alive ?? false,
  is_external: props.menu?.is_external ?? false,
});
const parents = computed(() => [
  { key: 0, value: 0, title: '顶级菜单' },
  ...menuParentOptions(props.menus, props.menu?.id),
]);
const busy = ref(false);
const error = ref('');
async function save() {
  error.value = '';
  if (!form.name.trim() || form.parent_id === undefined) {
    error.value = '请填写名称并选择上级菜单';
    return;
  }
  if (!Number.isInteger(form.sort)) {
    error.value = '排序必须为整数';
    return;
  }
  busy.value = true;
  const input: MenuInput = {
    ...form,
    name: form.name.trim(),
    path: form.path.trim() || null,
    component: form.component.trim() || null,
    icon: form.icon.trim() || null,
    permission_code: form.permission_code.trim() || null,
    redirect: form.redirect.trim() || null,
    meta: { ...props.menu?.meta },
  };
  try {
    await (props.menu
      ? updateAdminMenuApi(props.menu.id, input)
      : createAdminMenuApi(input));
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    open
    :title="menu ? '编辑菜单' : '新建菜单'"
    :width="640"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form layout="vertical" :disabled="busy">
      <Form.Item label="上级菜单" required>
        <TreeSelect
          v-model:value="form.parent_id"
          aria-label="上级菜单"
          :tree-data="parents"
          tree-default-expand-all
          show-search
          tree-node-filter-prop="title"
        />
      </Form.Item>
      <div class="grid grid-cols-2 gap-x-4">
        <Form.Item label="名称" required>
          <Input
            v-model:value="form.name"
            aria-label="菜单名称"
            :maxlength="256"
          />
        </Form.Item>
        <Form.Item label="类型" required>
          <Select
            v-model:value="form.type"
            aria-label="菜单类型"
            :options="menuTypes"
          />
        </Form.Item>
      </div>
      <Form.Item label="路径">
        <Input
          v-model:value="form.path"
          aria-label="菜单路径"
          placeholder="/system/example"
          :maxlength="2048"
        />
      </Form.Item>
      <Form.Item
        label="组件"
        help="填写已注册的组件路径，例如 /system/user/index.vue。"
      >
        <Input
          v-model:value="form.component"
          aria-label="菜单组件"
          :maxlength="2048"
        />
      </Form.Item>
      <div class="mt-4 grid grid-cols-2 gap-x-4">
        <Form.Item label="图标">
          <Input
            v-model:value="form.icon"
            aria-label="菜单图标"
            placeholder="lucide:users"
            :maxlength="256"
          />
        </Form.Item>
        <Form.Item label="排序">
          <InputNumber
            v-model:value="form.sort"
            aria-label="菜单排序"
            :precision="0"
            class="w-full"
          />
        </Form.Item>
      </div>
      <Form.Item
        label="权限码"
        help="填写后端已有权限码；菜单显示与接口授权分别配置。"
      >
        <Input
          v-model:value="form.permission_code"
          aria-label="菜单权限码"
          placeholder="system:user:list"
          :maxlength="256"
        />
      </Form.Item>
      <div class="mt-4 grid grid-cols-2 gap-x-4">
        <Form.Item label="可见">
          <Switch v-model:checked="form.visible" aria-label="菜单可见" />
        </Form.Item>
        <Form.Item label="状态">
          <Select
            v-model:value="form.status"
            aria-label="菜单状态"
            :options="[
              { label: '启用', value: 'active' },
              { label: '禁用', value: 'disabled' },
            ]"
          />
        </Form.Item>
      </div>
      <Form.Item label="重定向">
        <Input
          v-model:value="form.redirect"
          aria-label="菜单重定向"
          :maxlength="2048"
        />
      </Form.Item>
      <div class="grid grid-cols-2 gap-x-4">
        <Form.Item label="缓存页面">
          <Switch v-model:checked="form.keep_alive" aria-label="缓存页面" />
        </Form.Item>
        <Form.Item label="外部链接">
          <Switch v-model:checked="form.is_external" aria-label="外部链接" />
        </Form.Item>
      </div>
    </Form>
  </Modal>
</template>
