<script lang="ts" setup>
import { computed, onMounted, onUnmounted } from 'vue';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Cascader,
  Image,
  Select,
  Space,
  Table,
  Tag,
} from 'ant-design-vue';

import { hasCatalogPermission } from '#/auth/catalog-permission';
import { useMetaDictionary } from '#/composables/use-meta-dictionary';
import { formatDateTime } from '#/utils/datetime';
import { formatPriceRange } from '#/utils/money';

import {
  categoryLabel,
  categoryOptions,
  displayText,
  productSortOptions,
  productStatusValues,
} from './catalog-display';
import { useProductExport } from './use-product-export';
import { useProductList } from './use-product-list';

defineOptions({ name: 'CatalogProductList' });

const {
  categories,
  categoriesError,
  categoriesLoading,
  category,
  changePage,
  dispose,
  error,
  getAppliedQuery,
  load,
  loadCategories,
  loading,
  page,
  pageSize,
  parentSelected,
  products,
  reset,
  search,
  sort,
  statuses,
  total,
} = useProductList();
const { exportError, exporting, exportMessage, exportProducts } =
  useProductExport(getAppliedQuery);
const categoryTree = computed(() => categoryOptions(categories.value));
const dictionary = useMetaDictionary('product_status');
const statusOptions = computed(() =>
  productStatusValues.map((value) => ({
    value,
    label: dictionary.label(value),
  })),
);
const columns = [
  { dataIndex: 'main_image', title: '主图', width: 90 },
  { dataIndex: 'title', title: '标题', width: 240 },
  { dataIndex: 'category_id', title: '类目', width: 130 },
  { dataIndex: 'price', title: '价格区间', width: 170 },
  { dataIndex: 'sku_count', title: 'SKU 数', width: 100 },
  { dataIndex: 'status', title: '状态', width: 100 },
  { dataIndex: 'updated_at', title: '更新时间', width: 190 },
];
const pagination = computed(() => ({
  current: page.value,
  pageSize: pageSize.value,
  pageSizeOptions: ['1', '10', '20', '50', '100'],
  showQuickJumper: true,
  showSizeChanger: true,
  showTotal: (count: number) => `共 ${count} 条`,
  total: total.value,
}));
function handleTableChange(value: { current?: number; pageSize?: number }) {
  void changePage(value.current ?? 1, value.pageSize ?? pageSize.value);
}
onMounted(() => {
  void load();
  void loadCategories();
});
onUnmounted(dispose);
</script>

<template>
  <Page title="商品管理" description="查看商品、SKU 与关联平台商品。">
    <Card title="商品列表">
      <template #extra>
        <Button
          v-if="hasCatalogPermission('export')"
          :disabled="loading || Boolean(error)"
          :loading="exporting"
          @click="exportProducts"
        >
          导出商品
        </Button>
      </template>
      <form
        class="mb-4 flex flex-wrap items-center gap-3"
        @submit.prevent="search"
      >
        <label for="product-status">状态</label>
        <Select
          id="product-status"
          v-model:value="statuses"
          class="!w-52"
          :options="statusOptions"
          mode="multiple"
          allow-clear
          placeholder="全部状态"
          @change="search"
        />
        <label for="product-category">类目</label>
        <Cascader
          id="product-category"
          v-model:value="category"
          class="!w-60"
          :options="categoryTree"
          :loading="categoriesLoading"
          change-on-select
          allow-clear
          placeholder="全部类目"
          @change="search"
        />
        <label for="product-sort">排序</label>
        <Select
          id="product-sort"
          v-model:value="sort"
          class="!w-56"
          :options="productSortOptions"
          @change="search"
        />
        <Space>
          <Button type="primary" html-type="submit" :loading="loading">
            查询
          </Button>
          <Button :disabled="loading" @click="reset">重置</Button>
        </Space>
      </form>
      <Alert
        v-if="parentSelected"
        class="mb-4"
        type="warning"
        show-icon
        message="当前接口按所选类目精确筛选，尚不包含子类目商品。"
      />
      <Alert
        v-if="categoriesError"
        class="mb-4"
        type="warning"
        show-icon
        :message="`类目加载失败：${categoriesError}`"
      >
        <template #action>
          <Button size="small" @click="loadCategories">重试</Button>
        </template>
      </Alert>
      <Alert v-if="error" class="mb-4" type="error" show-icon :message="error">
        <template #action>
          <Button size="small" @click="search">重新查询</Button>
        </template>
      </Alert>
      <Alert
        v-if="exportError"
        class="mb-4"
        type="error"
        show-icon
        :message="`导出失败：${exportError}`"
      />
      <Alert
        v-if="exportMessage"
        class="mb-4"
        type="success"
        show-icon
        :message="exportMessage"
      />
      <Table
        data-testid="product-table"
        :columns="columns"
        :data-source="products"
        :loading="loading"
        :pagination="pagination"
        :scroll="{ x: 1050 }"
        :locale="{ emptyText: loading ? '加载中…' : '暂无商品' }"
        row-key="id"
        @change="handleTableChange"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.dataIndex === 'main_image'">
            <Image
              v-if="record.main_image"
              :src="record.main_image"
              :width="48"
              :height="48"
              :alt="record.title || '商品主图'"
            />
            <span v-else>—</span>
          </template>
          <template v-else-if="column.dataIndex === 'title'">
            <RouterLink
              v-if="hasCatalogPermission('read')"
              :to="`/catalog/products/${record.id}`"
              class="text-primary"
            >
              {{ displayText(text) }}
            </RouterLink>
            <template v-else>{{ displayText(text) }}</template>
          </template>
          <template v-else-if="column.dataIndex === 'category_id'">
            {{ categoryLabel(categories, record.category_id) }}
          </template>
          <template v-else-if="column.dataIndex === 'price'">
            {{
              formatPriceRange(record.price_min_cents, record.price_max_cents)
            }}
          </template>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="dictionary.color(record.status)"
          >
            {{ dictionary.label(record.status) }}
          </Tag>
          <template v-else-if="column.dataIndex === 'updated_at'">
            {{ formatDateTime(text) }}
          </template>
          <template v-else>{{ displayText(text) }}</template>
        </template>
      </Table>
    </Card>
  </Page>
</template>
