<script setup lang="ts">
import type { AdminMenu } from '#/api/model/system';

import { onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Modal,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteAdminMenuApi,
  getAdminMenuApi,
  getAdminMenusApi,
} from '#/api/core/system';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import MenuForm from './menu-form.vue';
import { menuBranchIds, menuTypeLabels } from './menu-options';

defineOptions({ name: 'SystemMenuList' });
const menus = ref<AdminMenu[]>([]);
const expanded = ref<(number | string)[]>([]);
const loading = ref(false);
const acting = ref(false);
const error = ref('');
const editing = ref<AdminMenu>();
const formOpen = ref(false);
const parentId = ref(0);
let sequence = 0;
const columns = [
  { dataIndex: 'name', title: '名称', width: 240 },
  { dataIndex: 'type', title: '类型', width: 80 },
  { dataIndex: 'path', title: '路径', width: 200 },
  { dataIndex: 'component', title: '组件', width: 240 },
  { dataIndex: 'icon', title: '图标', width: 150 },
  { dataIndex: 'sort', title: '排序', width: 80 },
  { dataIndex: 'visible', title: '可见', width: 80 },
  { dataIndex: 'status', title: '状态', width: 80 },
  { dataIndex: 'permission_code', title: '权限码', width: 200 },
  { dataIndex: 'actions', title: '操作', width: 240, fixed: 'right' as const },
];
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getAdminMenusApi();
    if (current !== sequence) return;
    menus.value = result;
    expanded.value = menuBranchIds(result);
  } catch (error_) {
    if (current === sequence) {
      error.value = toApiError(error_).message;
      menus.value = [];
    }
  } finally {
    if (current === sequence) loading.value = false;
  }
}
async function edit(menu?: AdminMenu, parent = 0) {
  acting.value = true;
  error.value = '';
  try {
    editing.value = menu ? await getAdminMenuApi(menu.id) : undefined;
    parentId.value = parent;
    formOpen.value = true;
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    acting.value = false;
  }
}
async function saved() {
  formOpen.value = false;
  await load();
  message.success('菜单已保存，重新登录后更新侧边栏');
}
function remove(menu: AdminMenu) {
  Modal.confirm({
    title: `删除菜单 ${menu.name}？`,
    content: '删除前请先删除子节点并解除角色授权。',
    okType: 'danger',
    async onOk() {
      acting.value = true;
      error.value = '';
      try {
        await deleteAdminMenuApi(menu.id);
        await load();
        message.success('菜单已删除，重新登录后更新侧边栏');
      } catch (error_) {
        const failure = toApiError(error_);
        error.value =
          failure.status === 409
            ? '菜单仍被引用，请先删除子节点并解除角色授权后重试（409）。'
            : failure.message;
      } finally {
        acting.value = false;
      }
    },
  });
}
onMounted(load);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page
    title="菜单管理"
    description="维护菜单结构与显示配置。修改后重新登录，侧边栏将加载最新配置。"
  >
    <Card title="菜单树">
      <template #extra>
        <Space>
          <Button
            @click="expanded = expanded.length ? [] : menuBranchIds(menus)"
          >
            {{ expanded.length ? '折叠全部' : '展开全部' }}
          </Button>
          <Button
            v-if="hasPermission('system:menu:create')"
            type="primary"
            :disabled="acting || loading"
            @click="edit()"
          >
            新建菜单
          </Button>
        </Space>
      </template>
      <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
        <template #action>
          <Button size="small" @click="load">刷新</Button>
        </template>
      </Alert>
      <Table
        v-model:expanded-row-keys="expanded"
        data-testid="menu-table"
        :columns="columns"
        :data-source="menus"
        :loading="loading"
        :pagination="false"
        :scroll="{ x: 1690 }"
        row-key="id"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.dataIndex === 'type'">
            {{ menuTypeLabels[record.type as AdminMenu['type']] }}
          </template>
          <Tag
            v-else-if="column.dataIndex === 'visible'"
            :color="text ? 'success' : 'default'"
          >
            {{ text ? '显示' : '隐藏' }}
          </Tag>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="text === 'active' ? 'success' : 'default'"
          >
            {{ text === 'active' ? '启用' : '禁用' }}
          </Tag>
          <Space v-else-if="column.dataIndex === 'actions'" wrap>
            <Button
              v-if="
                hasPermission('system:menu:create') &&
                (record.type === 'dir' || record.type === 'menu')
              "
              size="small"
              :disabled="acting || loading"
              @click="edit(undefined, record.id)"
            >
              新增子项
            </Button>
            <Button
              v-if="hasPermission('system:menu:update')"
              size="small"
              :disabled="acting || loading"
              @click="edit(record as AdminMenu)"
            >
              编辑
            </Button>
            <Button
              v-if="hasPermission('system:menu:delete')"
              size="small"
              danger
              :disabled="acting || loading"
              @click="remove(record as AdminMenu)"
            >
              删除
            </Button>
          </Space>
          <template v-else>{{ text ?? '—' }}</template>
        </template>
      </Table>
    </Card>
    <MenuForm
      v-if="formOpen"
      :menu="editing"
      :menus="menus"
      :parent-id="parentId"
      @close="formOpen = false"
      @saved="saved"
    />
  </Page>
</template>
