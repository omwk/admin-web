import type { Category, ProductDetail } from '#/api/model/catalog';

import { ref } from 'vue';

import { isCancel } from '@vben/request';

import { getCategoriesApi, getProductApi } from '#/api/core/catalog';
import { toApiError } from '#/api/errors';

export function useProductDetail() {
  const detail = ref<null | ProductDetail>(null);
  const categories = ref<Category[]>([]);
  const loading = ref(false);
  const error = ref('');
  let controller: AbortController | undefined;
  const categoryController = new AbortController();
  let sequence = 0;

  async function load(id: string) {
    const request = ++sequence;
    controller?.abort();
    controller = new AbortController();
    detail.value = null;
    error.value = '';
    if (!/^[1-9]\d*$/.test(id)) {
      error.value = '商品编号不正确';
      loading.value = false;
      return;
    }
    loading.value = true;
    try {
      const data = await getProductApi(id, {
        signal: controller.signal,
        silent: true,
      });
      if (request === sequence) detail.value = data;
    } catch (error_) {
      if (request === sequence && !isCancel(error_))
        error.value = toApiError(error_).message;
    } finally {
      if (request === sequence) loading.value = false;
    }
  }

  async function loadCategories() {
    try {
      categories.value = await getCategoriesApi({
        signal: categoryController.signal,
        silent: true,
      });
    } catch {
      // Category permission is independent of read permission; keep missing labels as a dash.
    }
  }

  function dispose() {
    sequence++;
    controller?.abort();
    categoryController.abort();
  }

  return { categories, detail, dispose, error, load, loadCategories, loading };
}
