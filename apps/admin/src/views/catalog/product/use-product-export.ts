import type { useProductList } from './use-product-list';

import { ref } from 'vue';

import { exportProductsApi } from '#/api/core/catalog';
import { toApiError } from '#/api/errors';

export function useProductExport(
  getQuery: ReturnType<typeof useProductList>['getAppliedQuery'],
) {
  const exporting = ref(false);
  const exportError = ref('');
  const exportMessage = ref('');
  let retry: undefined | { key: string; signature: string };

  async function exportProducts() {
    if (exporting.value) return;
    const query = getQuery();
    const signature = JSON.stringify(query);
    if (retry?.signature !== signature)
      retry = { key: crypto.randomUUID(), signature };
    exporting.value = true;
    exportError.value = '';
    exportMessage.value = '';
    try {
      const data = await exportProductsApi(
        query.filters,
        query.sort,
        retry.key,
        { silent: true },
      );
      exportMessage.value = `导出任务已创建，编号 ${data.export_id}（${data.status}）`;
      retry = undefined;
    } catch (error) {
      exportError.value = toApiError(error).message;
    } finally {
      exporting.value = false;
    }
  }

  return { exportError, exporting, exportMessage, exportProducts };
}
