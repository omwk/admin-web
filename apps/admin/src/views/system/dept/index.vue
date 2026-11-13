<script setup lang="ts">
import type { Department } from '#/api/model/system';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Badge,
  Button,
  Card,
  Descriptions,
  Empty,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Tag,
  Tree,
} from 'ant-design-vue';

import {
  deleteDepartmentApi,
  getDepartmentApi,
  getDepartmentsApi,
} from '#/api/core/system';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import { nodeLabel } from '../shared/tree';
import DepartmentForm from './department-form.vue';
import {
  departmentTreeNodes,
  filterDepartments,
  flattenDepartments,
} from './department-tree';

defineOptions({ name: 'SystemDepartmentList' });
const departments = ref<Department[]>([]);
const keyword = ref('');
const expanded = ref<(number | string)[]>([]);
const selectedId = ref<number>();
const detail = ref<Department>();
const mode = ref<'create' | 'edit'>();
const parentId = ref(0);
const loading = ref(false);
const detailLoading = ref(false);
const saving = ref(false);
const acting = ref(false);
const error = ref('');
let treeSequence = 0;
let detailSequence = 0;
const filtered = computed(() =>
  filterDepartments(departments.value, keyword.value),
);
const rootDepartment = computed(() =>
  departments.value.find((department) => department.parent_id === 0),
);
const busy = computed(
  () => loading.value || detailLoading.value || saving.value || acting.value,
);
const formPermission = computed(() =>
  hasPermission(
    mode.value === 'edit' ? 'system:dept:update' : 'system:dept:create',
  ),
);

async function selectDepartment(id: number) {
  const current = ++detailSequence;
  selectedId.value = id;
  detail.value = undefined;
  mode.value = undefined;
  detailLoading.value = true;
  error.value = '';
  try {
    const result = await getDepartmentApi(id);
    if (current === detailSequence) detail.value = result;
  } catch (error_) {
    if (current === detailSequence) error.value = toApiError(error_).message;
  } finally {
    if (current === detailSequence) detailLoading.value = false;
  }
}

async function load(preferredId = selectedId.value) {
  const current = ++treeSequence;
  // Invalidate any outstanding detail request before reloading hierarchy.
  detailSequence++;
  detailLoading.value = false;
  loading.value = true;
  error.value = '';
  try {
    const result = await getDepartmentsApi();
    if (current !== treeSequence) return;
    departments.value = result;
    const nodes = flattenDepartments(result);
    expanded.value = nodes
      .filter((node) => node.children?.length)
      .map((node) => node.id);
    const selected = nodes.find((node) => node.id === preferredId) ?? nodes[0];
    if (selected) {
      await selectDepartment(selected.id);
    } else {
      selectedId.value = undefined;
      detail.value = undefined;
      mode.value = undefined;
    }
  } catch (error_) {
    if (current === treeSequence) error.value = toApiError(error_).message;
  } finally {
    if (current === treeSequence) loading.value = false;
  }
}

function createFirstLevel() {
  if (rootDepartment.value) create(rootDepartment.value.id);
}

function create(parent: number) {
  detailSequence++;
  detailLoading.value = false;
  parentId.value = parent;
  error.value = '';
  mode.value = 'create';
}

async function edit(department: Department) {
  await selectDepartment(department.id);
  if (detail.value?.id === department.id) mode.value = 'edit';
}

async function saved(department: Department) {
  mode.value = undefined;
  // The server recalculates every descendant path; always reload the full tree.
  await load(department.id);
  if (!error.value) message.success('部门已保存');
}

function remove(department: Department) {
  Modal.confirm({
    title: `删除「${department.name}」？`,
    content: `删除「${
      department.name
    }」后不可恢复。若该部门下有子部门或在册用户，后端会拒绝删除。`,
    okText: '确认删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      acting.value = true;
      error.value = '';
      try {
        await deleteDepartmentApi(department.id);
        await load(
          selectedId.value === department.id
            ? department.parent_id
            : selectedId.value,
        );
        if (!error.value) message.success('部门已删除');
      } catch (error_) {
        error.value = toApiError(error_).message;
      } finally {
        acting.value = false;
      }
    },
  });
}

onMounted(() => load());
onUnmounted(() => {
  treeSequence++;
  detailSequence++;
});
</script>

<template>
  <Page title="部门管理" description="维护部门信息与上下级关系。">
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template #action>
        <Button size="small" :disabled="busy" @click="load()">重试</Button>
      </template>
    </Alert>
    <div class="grid grid-cols-1 items-start gap-4 xl:grid-cols-2">
      <Card title="部门树" class="min-w-0">
        <template #extra>
          <Space>
            <Button :disabled="busy" @click="load()">刷新</Button>
            <Button
              v-if="hasPermission('system:dept:create')"
              type="primary"
              :disabled="busy || !rootDepartment"
              @click="createFirstLevel"
            >
              新增一级部门
            </Button>
          </Space>
        </template>
        <Input.Search
          v-model:value="keyword"
          aria-label="搜索部门"
          placeholder="按部门名称搜索"
          allow-clear
          class="mb-4"
        />
        <Spin :spinning="loading">
          <!-- Full reloads can remove nodes still cached by Ant Tree's leave motion. -->
          <Tree
            v-if="filtered.length"
            data-testid="department-tree"
            :motion="null"
            :expanded-keys="
              keyword.trim()
                ? flattenDepartments(filtered).map((node) => node.id)
                : expanded
            "
            :disabled="saving || acting || loading"
            :selected-keys="selectedId ? [selectedId] : []"
            :tree-data="departmentTreeNodes(filtered)"
            :field-names="{ key: 'id', title: 'name' }"
            block-node
            @expand="expanded = $event"
            @select="(keys) => keys[0] && selectDepartment(Number(keys[0]))"
          >
            <template #title="department">
              <div
                :data-dept-id="department.id"
                class="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 py-1"
              >
                <Space>
                  <span>{{ department.name }}</span>
                  <Badge
                    :count="department.member_count"
                    :overflow-count="Number.MAX_SAFE_INTEGER"
                    :title="`成员数：${department.member_count}`"
                    show-zero
                    :number-style="{ backgroundColor: '#64748b' }"
                  />
                  <Tag
                    :color="
                      department.status === 'active' ? 'success' : 'default'
                    "
                  >
                    {{ department.status === 'active' ? '启用' : '停用' }}
                  </Tag>
                </Space>
                <Space size="small">
                  <Button
                    v-if="hasPermission('system:dept:create')"
                    size="small"
                    :disabled="busy"
                    @click.stop="create(department.id)"
                  >
                    新增子部门
                  </Button>
                  <Button
                    v-if="hasPermission('system:dept:update')"
                    size="small"
                    :disabled="busy"
                    @click.stop="edit(department)"
                  >
                    编辑
                  </Button>
                  <Button
                    v-if="hasPermission('system:dept:delete')"
                    size="small"
                    danger
                    :disabled="busy"
                    @click.stop="remove(department)"
                  >
                    删除
                  </Button>
                </Space>
              </div>
            </template>
          </Tree>
          <Empty
            v-else-if="!loading && !error"
            :description="departments.length ? '没有匹配的部门' : '暂无部门'"
          />
        </Spin>
      </Card>
      <Card
        :title="
          mode === 'create'
            ? '新增部门'
            : mode === 'edit'
              ? '编辑部门'
              : '部门详情'
        "
        class="min-w-0"
      >
        <Spin :spinning="detailLoading || loading">
          <DepartmentForm
            v-if="mode && formPermission"
            :key="`${mode}-${detail?.id ?? 0}-${parentId}`"
            :department="mode === 'edit' ? detail : undefined"
            :departments="departments"
            :parent-id="parentId"
            @busy="saving = $event"
            @close="mode = undefined"
            @saved="saved"
          />
          <Descriptions
            v-else-if="detail"
            data-testid="department-detail"
            :column="1"
            bordered
          >
            <Descriptions.Item label="名称">
              {{ detail.name }}
            </Descriptions.Item>
            <Descriptions.Item label="上级部门">
              {{
                detail.parent_id
                  ? nodeLabel(departments, detail.parent_id)
                  : '无（根）'
              }}
            </Descriptions.Item>
            <Descriptions.Item label="层级路径">
              {{ detail.path }}
            </Descriptions.Item>
            <Descriptions.Item label="成员数">
              {{ detail.member_count }}
            </Descriptions.Item>
            <Descriptions.Item label="排序">
              {{ detail.sort }}
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag :color="detail.status === 'active' ? 'success' : 'default'">
                {{ detail.status === 'active' ? '启用' : '停用' }}
              </Tag>
            </Descriptions.Item>
          </Descriptions>
          <Empty
            v-else-if="!detailLoading && !loading"
            description="请选择一个部门查看详情"
          />
        </Spin>
      </Card>
    </div>
  </Page>
</template>
