import type {
  CatalogID,
  Category,
  ProductFilters,
  ProductPage,
  ProductSort,
  ProductStatus,
  ProductSummary,
} from '#/api/model/catalog';

import { computed, ref } from 'vue';

import { isCancel } from '@vben/request';

import {
  getCategoriesApi,
  getProductsApi,
  normalizeProductQuery,
} from '#/api/core/catalog';
import { toApiError } from '#/api/errors';

export function useProductList() {
  const categories = ref<Category[]>([]);
  const categoriesLoading = ref(false);
  const categoriesError = ref('');
  const category = ref<CatalogID[]>([]);
  const statuses = ref<ProductStatus[]>([]);
  const sort = ref<ProductSort>('-updated_at');
  const page = ref(1);
  const pageSize = ref(20);
  const total = ref(0);
  const products = ref<ProductSummary[]>([]);
  const loading = ref(false);
  const error = ref('');
  const cursors = new Map<number, string>();
  let filters: ProductFilters = {};
  let appliedSort: ProductSort = '-updated_at';
  let controller: AbortController | undefined;
  const categoryController = new AbortController();
  let sequence = 0;
  const parentSelected = computed(() =>
    categories.value.some(
      (item) => String(item.parent_id) === String(category.value.at(-1)),
    ),
  );

  async function loadCategories() {
    categoriesLoading.value = true;
    categoriesError.value = '';
    try {
      categories.value = await getCategoriesApi({
        signal: categoryController.signal,
        silent: true,
      });
    } catch (error_) {
      if (!isCancel(error_)) categoriesError.value = toApiError(error_).message;
    } finally {
      categoriesLoading.value = false;
    }
  }

  async function load(target = page.value) {
    const request = ++sequence;
    controller?.abort();
    controller = new AbortController();
    const signal = controller.signal;
    loading.value = true;
    error.value = '';
    const readPage = async (current: number): Promise<ProductPage> => {
      const data = await getProductsApi(
        {
          ...filters,
          cursor: current > 100 ? cursors.get(current) : undefined,
          page: current,
          page_size: pageSize.value,
          sort: appliedSort,
        },
        { signal, silent: true },
      );
      if (request === sequence && data.next_cursor)
        cursors.set(data.page + 1, data.next_cursor);
      return data;
    };
    try {
      if (target > 100 && appliedSort !== '-updated_at') {
        error.value =
          '当前接口的深分页仅支持更新时间由新到旧，请切换排序后重试。';
        return;
      }
      if (target > 100 && !cursors.has(target)) {
        let current = Math.max(
          100,
          ...[...cursors.keys()].filter((value) => value <= target),
        );
        while (current < target) {
          const bridge = await readPage(current);
          if (request !== sequence) return;
          if (!bridge.next_cursor) {
            error.value = '接口未返回下一页游标，请刷新列表后重试。';
            return;
          }
          current++;
        }
      }
      const data = await readPage(target);
      if (request !== sequence) return;
      products.value = data.list ?? [];
      total.value = data.total;
      page.value = data.page;
    } catch (error_) {
      if (request !== sequence || isCancel(error_)) return;
      cursors.clear();
      error.value = toApiError(error_).message;
    } finally {
      if (request === sequence) loading.value = false;
    }
  }

  async function search() {
    controller?.abort();
    sequence++;
    loading.value = false;
    products.value = [];
    total.value = 0;
    page.value = 1;
    cursors.clear();
    if (statuses.value.length > 1) {
      error.value = '当前接口仅支持单个状态，请保留一个状态或清空后查询。';
      return;
    }
    filters = { category_id: category.value.at(-1), status: statuses.value[0] };
    appliedSort = sort.value;
    await load(1);
  }

  async function reset() {
    category.value = [];
    statuses.value = [];
    sort.value = '-updated_at';
    await search();
  }

  async function changePage(current: number, size: number) {
    const normalized = normalizeProductQuery({
      page: current,
      page_size: size,
    });
    if (normalized.page_size === pageSize.value) {
      await load(normalized.page);
    } else {
      pageSize.value = normalized.page_size;
      cursors.clear();
      await load(1);
    }
  }

  function dispose() {
    sequence++;
    controller?.abort();
    categoryController.abort();
  }

  return {
    categories,
    categoriesError,
    categoriesLoading,
    category,
    changePage,
    dispose,
    error,
    getAppliedQuery: () => ({ filters: { ...filters }, sort: appliedSort }),
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
  };
}
