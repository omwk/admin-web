<script setup lang="ts">
import type { TablePaginationConfig } from 'ant-design-vue';

import type {
  Dictionary,
  DictionaryItem,
  DictionaryScope,
} from '#/api/model/configuration';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Collapse,
  Empty,
  message,
  Modal,
  Space,
  Spin,
  Table,
  Tag,
} from 'ant-design-vue';

import {
  deleteDictionaryApi,
  deleteDictionaryItemApi,
  getAllDictionariesApi,
  getDictionaryItemsApi,
} from '#/api/core/dictionaries';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';
import {
  invalidateMetaDictionary,
  useMetaDictionary,
} from '#/composables/use-meta-dictionary';

import DictionaryForm from './dictionary-form.vue';
import ItemForm from './item-form.vue';

defineOptions({ name: 'SystemDictionaryList' });
const scopes: { label: string; value: DictionaryScope }[] = [
  { label: '系统字典', value: 'system' },
  { label: '业务字典', value: 'business' },
];
const groups = ref<Record<DictionaryScope, Dictionary[]>>({
  system: [],
  business: [],
});
const counts = ref<Record<number, number>>({});
const selected = ref<Dictionary>();
const items = ref<DictionaryItem[]>([]);
const expanded = ref(['system', 'business']);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const loading = ref(false);
const itemLoading = ref(false);
const saving = ref(false);
const acting = ref(false);
const error = ref('');
const dictionaryForm = ref(false);
const editingDictionary = ref<Dictionary>();
const itemForm = ref(false);
const editingItem = ref<DictionaryItem>();
const statuses = useMetaDictionary('user_status');
let listSequence = 0;
let itemSequence = 0;
const busy = computed(
  () => loading.value || itemLoading.value || saving.value || acting.value,
);
const columns = computed(() => [
  { dataIndex: 'label', title: '标签' },
  { dataIndex: 'value', title: '值' },
  { dataIndex: 'sort', title: '排序', width: 90 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'color', title: '颜色', width: 120 },
  ...(hasPermission('system:dict:update') ||
  (selected.value?.scope === 'business' && hasPermission('system:dict:delete'))
    ? [{ dataIndex: 'actions', title: '操作', width: 150 }]
    : []),
]);
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  total: total.value,
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 项`,
}));
async function loadItems(
  dictionary = selected.value,
  requestedPage = page.value,
  requestedSize = pageSize.value,
) {
  const current = ++itemSequence;
  items.value = [];
  total.value = 0;
  if (!dictionary) {
    itemLoading.value = false;
    return;
  }
  itemLoading.value = true;
  error.value = '';
  try {
    const result = await getDictionaryItemsApi(
      dictionary.id,
      requestedPage,
      requestedSize,
    );
    if (current !== itemSequence) return;
    counts.value[dictionary.id] = result.total;
    if (result.list.length === 0 && result.total > 0 && requestedPage > 1) {
      return await loadItems(
        dictionary,
        Math.ceil(result.total / requestedSize),
        requestedSize,
      );
    }
    items.value = result.list;
    page.value = result.page;
    pageSize.value = result.page_size;
    total.value = result.total;
  } catch (error_) {
    if (current === itemSequence) error.value = toApiError(error_).message;
  } finally {
    if (current === itemSequence) itemLoading.value = false;
  }
}
async function select(dictionary: Dictionary) {
  selected.value = dictionary;
  page.value = 1;
  await loadItems(dictionary, 1);
}
async function load(preferredId = selected.value?.id) {
  const current = ++listSequence;
  itemSequence++;
  itemLoading.value = false;
  loading.value = true;
  error.value = '';
  try {
    const [system, business] = await Promise.all([
      getAllDictionariesApi('system'),
      getAllDictionariesApi('business'),
    ]);
    const dictionaries = [...system, ...business];
    const sizes = await Promise.all(
      dictionaries.map(async (dictionary) => {
        const result = await getDictionaryItemsApi(dictionary.id, 1, 1);
        return [dictionary.id, result.total];
      }),
    );
    if (current !== listSequence) return;
    groups.value = { system, business };
    counts.value = Object.fromEntries(sizes);
    const next =
      dictionaries.find((dictionary) => dictionary.id === preferredId) ??
      dictionaries[0];
    selected.value = next;
    page.value = 1;
    await loadItems(next, 1);
  } catch (error_) {
    if (current === listSequence) error.value = toApiError(error_).message;
  } finally {
    if (current === listSequence) loading.value = false;
  }
}
function editDictionary(dictionary?: Dictionary) {
  if (dictionary?.scope === 'system' || busy.value) return;
  editingDictionary.value = dictionary;
  dictionaryForm.value = true;
}
function editItem(item?: DictionaryItem) {
  if (
    busy.value ||
    !selected.value ||
    (!item && selected.value.scope === 'system')
  )
    return;
  editingItem.value = item;
  itemForm.value = true;
}
async function dictionarySaved(dictionary: Dictionary) {
  dictionaryForm.value = false;
  if (editingDictionary.value)
    invalidateMetaDictionary(editingDictionary.value.type);
  invalidateMetaDictionary(dictionary.type);
  await load(dictionary.id);
  message.success('字典已保存');
}
async function itemSaved() {
  itemForm.value = false;
  if (selected.value) invalidateMetaDictionary(selected.value.type);
  await loadItems();
  message.success('字典项已保存');
}
function remove(dictionary: Dictionary, item?: DictionaryItem) {
  if (
    dictionary.scope === 'system' ||
    busy.value ||
    !hasPermission('system:dict:delete')
  )
    return;
  Modal.confirm({
    title: item
      ? `删除字典项「${item.label}」？`
      : `删除字典「${dictionary.name}」？`,
    content: item
      ? '删除后不可恢复。'
      : '删除前须先清空字典项，后端将检查并保护仍含项的字典。',
    okText: '确认删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      acting.value = true;
      error.value = '';
      try {
        await (item
          ? deleteDictionaryItemApi(item.id)
          : deleteDictionaryApi(dictionary.id));
        invalidateMetaDictionary(dictionary.type);
        await (item ? loadItems() : load());
        message.success(item ? '字典项已删除' : '字典已删除');
      } catch (error_) {
        error.value = toApiError(error_).message;
      } finally {
        acting.value = false;
      }
    },
  });
}
function changePage(pagination_: TablePaginationConfig) {
  void loadItems(
    selected.value,
    pagination_.current ?? 1,
    pagination_.pageSize ?? 20,
  );
}
onMounted(() => load());
onUnmounted(() => {
  listSequence++;
  itemSequence++;
});
</script>

<template>
  <Page
    title="数据字典"
    description="维护业务字典；系统字典仅允许调整项标签与排序。"
  >
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template #action>
        <Button size="small" :disabled="busy" @click="load()"> 重试 </Button>
      </template>
    </Alert>
    <div
      class="grid grid-cols-1 items-start gap-4 xl:grid-cols-[340px_minmax(0,1fr)]"
    >
      <Card title="字典类型" class="min-w-0" data-testid="dictionary-groups">
        <template #extra>
          <Button :disabled="busy" @click="load()">刷新</Button>
        </template>
        <Spin :spinning="loading">
          <Collapse v-model:active-key="expanded">
            <Collapse.Panel
              v-for="scope in scopes"
              :key="scope.value"
              :header="`${scope.label}（${groups[scope.value].length}）`"
            >
              <Button
                v-if="
                  scope.value === 'business' &&
                  hasPermission('system:dict:create')
                "
                type="primary"
                size="small"
                class="mb-3"
                :disabled="busy"
                @click="editDictionary()"
              >
                新增业务字典
              </Button>
              <Empty
                v-if="!groups[scope.value].length"
                description="暂无字典"
                :image="Empty.PRESENTED_IMAGE_SIMPLE"
              />
              <div
                v-for="dictionary in groups[scope.value]"
                :key="dictionary.id"
                class="mb-3 rounded border p-3"
                :class="{ 'border-primary': selected?.id === dictionary.id }"
                :data-dict-type="dictionary.type"
              >
                <Button
                  type="link"
                  class="h-auto whitespace-normal p-0"
                  :disabled="loading || saving || acting"
                  :aria-pressed="selected?.id === dictionary.id"
                  @click="select(dictionary)"
                >
                  <span class="text-left">
                    <strong class="block">{{ dictionary.name }}</strong>
                    <small class="block">{{ dictionary.type }}</small>
                  </span>
                </Button>
                <div class="mt-2 flex flex-wrap items-center gap-2">
                  <Tag>{{ counts[dictionary.id] ?? '…' }} 项</Tag>
                  <Tag v-if="dictionary.scope === 'system'">系统</Tag>
                  <Space v-else>
                    <Button
                      v-if="hasPermission('system:dict:update')"
                      type="link"
                      size="small"
                      :disabled="busy"
                      @click="editDictionary(dictionary)"
                    >
                      编辑字典
                    </Button>
                    <Button
                      v-if="hasPermission('system:dict:delete')"
                      type="link"
                      size="small"
                      danger
                      :disabled="busy"
                      @click="remove(dictionary)"
                    >
                      删除字典
                    </Button>
                  </Space>
                </div>
              </div>
            </Collapse.Panel>
          </Collapse>
        </Spin>
      </Card>
      <Card
        :title="selected ? `${selected.name} · ${selected.type}` : '字典项'"
        class="min-w-0"
        data-testid="dictionary-items"
      >
        <template #extra>
          <Button
            v-if="
              selected?.scope === 'business' &&
              hasPermission('system:dict:create')
            "
            type="primary"
            :disabled="busy"
            @click="editItem()"
          >
            新增项
          </Button>
        </template>
        <Alert
          v-if="selected?.scope === 'system'"
          message="系统字典：仅可修改标签和排序，不可新增或删除项"
          type="info"
          show-icon
          class="mb-4"
        />
        <Table
          v-if="selected"
          row-key="id"
          :columns="columns"
          :data-source="items"
          :pagination="pagination"
          :loading="itemLoading"
          :scroll="{ x: 720 }"
          @change="changePage"
        >
          <template #emptyText>暂无字典项</template>
          <template #bodyCell="{ column, record }">
            <Tag
              v-if="column.dataIndex === 'status'"
              :color="statuses.color(record.status)"
            >
              {{ statuses.label(record.status) }}
            </Tag>
            <Tag
              v-else-if="column.dataIndex === 'color' && record.color"
              :color="record.color"
            >
              {{ record.color }}
            </Tag>
            <span v-else-if="column.dataIndex === 'color'">—</span>
            <Space v-else-if="column.dataIndex === 'actions'">
              <Button
                v-if="hasPermission('system:dict:update')"
                type="link"
                size="small"
                :disabled="busy"
                @click="editItem(record as DictionaryItem)"
              >
                编辑
              </Button>
              <Button
                v-if="
                  selected.scope === 'business' &&
                  hasPermission('system:dict:delete')
                "
                type="link"
                size="small"
                danger
                :disabled="busy"
                @click="remove(selected, record as DictionaryItem)"
              >
                删除
              </Button>
            </Space>
          </template>
        </Table>
        <Empty v-else description="请选择字典类型" />
      </Card>
    </div>
    <DictionaryForm
      v-if="dictionaryForm"
      :dictionary="editingDictionary"
      @busy="saving = $event"
      @close="dictionaryForm = false"
      @saved="dictionarySaved"
    />
    <ItemForm
      v-if="itemForm && selected"
      :dictionary="selected"
      :item="editingItem"
      @busy="saving = $event"
      @close="itemForm = false"
      @saved="itemSaved"
    />
  </Page>
</template>
