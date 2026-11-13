<script setup lang="ts">
import type { Department, DepartmentInput } from '#/api/model/system';

import { computed, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Form,
  Input,
  InputNumber,
  Select,
  Space,
  TreeSelect,
} from 'ant-design-vue';

import { createDepartmentApi, updateDepartmentApi } from '#/api/core/system';
import { toApiError } from '#/api/errors';

import { departmentParentOptions } from './department-tree';

const props = defineProps<{
  department?: Department;
  departments: Department[];
  parentId: number;
}>();
const emit = defineEmits<{
  busy: [boolean];
  close: [];
  saved: [Department];
}>();
const form = reactive<DepartmentInput>({
  parent_id: props.department?.parent_id ?? props.parentId,
  name: props.department?.name ?? '',
  sort: props.department?.sort ?? 0,
  status: props.department?.status ?? 'active',
});
const creatingFirstLevel = computed(
  () =>
    !props.department &&
    props.departments.some(
      (department) =>
        department.parent_id === 0 && department.id === props.parentId,
    ),
);
const parents = computed(() => [
  ...(props.department?.parent_id === 0
    ? [{ key: 0, value: 0, title: '无（根）' }]
    : []),
  ...departmentParentOptions(props.departments, props.department?.id),
]);
const busy = ref(false);
const error = ref('');

async function save() {
  if (busy.value) return;
  error.value = '';
  const parentId = creatingFirstLevel.value ? props.parentId : form.parent_id;
  const name = form.name.trim();
  if (!name || [...name].length > 64) {
    error.value = '名称必填，长度为 1–64 字';
    return;
  }
  if (
    !Number.isInteger(parentId) ||
    parentId < 0 ||
    (parentId === 0 && props.department?.parent_id !== 0)
  ) {
    error.value = '请选择上级部门';
    return;
  }
  if (
    !Number.isInteger(form.sort) ||
    form.sort < -2_147_483_648 ||
    form.sort > 2_147_483_647
  ) {
    error.value = '排序必须为 32 位整数';
    return;
  }
  const parent = flattenOptions(parents.value).find(
    (option) => option.value === parentId,
  );
  if (!parent || parent.disabled) {
    error.value = '上级部门不能是自身或后代';
    return;
  }
  busy.value = true;
  emit('busy', true);
  try {
    const input: DepartmentInput = {
      parent_id: parentId,
      name,
      sort: form.sort,
      status: form.status,
    };
    const department = await (props.department
      ? updateDepartmentApi(props.department.id, input)
      : createDepartmentApi(input));
    emit('saved', department);
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
    emit('busy', false);
  }
}

function flattenOptions(
  options: ReturnType<typeof departmentParentOptions>,
): ReturnType<typeof departmentParentOptions> {
  return options.flatMap((option) => [
    option,
    ...flattenOptions(option.children ?? []),
  ]);
}
</script>

<template>
  <div data-testid="department-form">
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Form :model="form" layout="vertical" :disabled="busy" @finish="save">
      <Form.Item v-if="!creatingFirstLevel" label="上级部门" required>
        <TreeSelect
          v-model:value="form.parent_id"
          aria-label="上级部门"
          :tree-data="parents"
          tree-default-expand-all
          show-search
          tree-node-filter-prop="title"
          placeholder="选择上级部门"
          class="w-full"
        />
      </Form.Item>
      <Form.Item label="名称" required>
        <Input
          v-model:value="form.name"
          aria-label="部门名称"
          :maxlength="64"
          placeholder="请输入部门名称"
          show-count
        />
      </Form.Item>
      <Form.Item label="排序">
        <InputNumber
          v-model:value="form.sort"
          aria-label="部门排序"
          :min="-2_147_483_648"
          :max="2_147_483_647"
          :precision="0"
          class="w-full"
        />
      </Form.Item>
      <Form.Item label="状态" required>
        <Select
          v-model:value="form.status"
          aria-label="部门状态"
          :options="[
            { label: '启用', value: 'active' },
            { label: '停用', value: 'disabled' },
          ]"
        />
      </Form.Item>
      <Space>
        <Button type="primary" html-type="submit" :loading="busy">
          保存
        </Button>
        <Button :disabled="busy" @click="emit('close')">取消</Button>
      </Space>
    </Form>
  </div>
</template>
