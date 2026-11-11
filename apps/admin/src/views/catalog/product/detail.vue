<script lang="ts" setup>
import { computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Descriptions,
  Image,
  Skeleton,
  Table,
  Tag,
} from 'ant-design-vue';

import { hasCatalogPermission } from '#/auth/catalog-permission';
import { hasPermission } from '#/auth/permission';
import { formatDateTime } from '#/utils/datetime';
import { formatCents, formatPriceRange } from '#/utils/money';

import {
  categoryLabel,
  displayText,
  productStatusLabel,
} from './catalog-display';
import { useProductDetail } from './use-product-detail';

defineOptions({ name: 'CatalogProductDetail' });

const route = useRoute();
const router = useRouter();
const { categories, detail, dispose, error, load, loadCategories, loading } =
  useProductDetail();
const product = computed(() => detail.value?.product);
const skus = computed(() => detail.value?.skus ?? []);
const listings = computed(() => detail.value?.listings ?? []);
const skuColumns = [
  { dataIndex: 'title', title: '规格', width: 240 },
  { dataIndex: 'code', title: '编码', width: 200 },
  { dataIndex: 'price_cents', title: '价格', width: 160 },
  { dataIndex: 'stock', title: '库存', width: 120 },
];
const listingColumns = [
  { dataIndex: 'platform_id', title: '平台 ID', width: 160 },
  { dataIndex: 'external_product_id', title: '外部 ID', width: 240 },
  { dataIndex: 'status', title: '状态', width: 160 },
  { dataIndex: 'synced_at', title: '最后同步时间', width: 200 },
];
const reload = () => load(String(route.params.id ?? ''));
watch(() => route.params.id, reload, { immediate: true });
onMounted(() => {
  if (hasPermission('product:category:list')) void loadCategories();
});
onUnmounted(dispose);
</script>

<template>
  <Page title="商品详情" description="商品概览、SKU 和关联 listing。">
    <Button
      v-if="hasCatalogPermission('list')"
      class="mb-4"
      @click="router.push('/catalog/products')"
    >
      返回列表
    </Button>
    <Alert v-if="error" class="mb-4" type="error" show-icon :message="error">
      <template #action>
        <Button size="small" @click="reload">重试</Button>
      </template>
    </Alert>
    <Card v-if="loading" title="商品概览"><Skeleton active /></Card>
    <template v-else-if="product">
      <Card class="mb-4" title="商品概览">
        <div class="mb-4 flex items-center gap-4">
          <Image
            v-if="product.main_image"
            :src="product.main_image"
            :width="80"
            :height="80"
            :alt="product.title || '商品主图'"
          />
          <h2 class="text-xl font-semibold">
            {{ displayText(product.title) }}
          </h2>
          <Tag :color="product.status === 'active' ? 'success' : 'default'">
            {{ productStatusLabel(product.status) }}
          </Tag>
        </div>
        <Descriptions bordered :column="{ xs: 1, sm: 2, lg: 3 }">
          <Descriptions.Item label="类目">
            {{ categoryLabel(categories, product.category_id) }}
          </Descriptions.Item>
          <Descriptions.Item label="价格区间">
            {{
              formatPriceRange(product.price_min_cents, product.price_max_cents)
            }}
          </Descriptions.Item>
          <Descriptions.Item label="SKU 数">
            {{ displayText(product.sku_count) }}
          </Descriptions.Item>
          <Descriptions.Item label="商品编码">
            {{ displayText(product.code) }}
          </Descriptions.Item>
          <Descriptions.Item label="品牌">
            {{ displayText(product.brand) }}
          </Descriptions.Item>
          <Descriptions.Item label="更新时间">
            {{ formatDateTime(product.updated_at) }}
          </Descriptions.Item>
        </Descriptions>
      </Card>
      <Card class="mb-4" :title="`SKU（${skus.length}）`">
        <Table
          data-testid="sku-table"
          :columns="skuColumns"
          :data-source="skus"
          :pagination="false"
          :scroll="{ x: 720 }"
          :locale="{ emptyText: '—' }"
          row-key="id"
        >
          <template #bodyCell="{ column, record, text }">
            <template v-if="column.dataIndex === 'price_cents'">
              {{ formatCents(text) }}
            </template>
            <template v-else-if="column.dataIndex === 'stock'">—</template>
            <template v-else-if="column.dataIndex === 'title'">
              {{
                record.title ||
                Object.entries(record.attributes ?? {})
                  .map(([key, value]) => `${key}：${displayText(value)}`)
                  .join('，') ||
                '—'
              }}
            </template>
            <template v-else>{{ displayText(text) }}</template>
          </template>
        </Table>
      </Card>
      <Card :title="`关联 listing（${listings.length}）`">
        <Table
          data-testid="listing-table"
          :columns="listingColumns"
          :data-source="listings"
          :pagination="false"
          :scroll="{ x: 760 }"
          :locale="{ emptyText: '—' }"
          row-key="id"
        >
          <template #bodyCell="{ column, text }">
            <template v-if="column.dataIndex === 'synced_at'">
              {{ formatDateTime(text) }}
            </template>
            <template v-else>{{ displayText(text) }}</template>
          </template>
        </Table>
      </Card>
    </template>
  </Page>
</template>
