import type { ApiRequestConfig } from '#/api/client';
import type {
  CatalogID,
  Category,
  ProductDetail,
  ProductExport,
  ProductFilters,
  ProductPage,
  ProductQuery,
  ProductSort,
} from '#/api/model/catalog';

import { parseCatalogJSON } from '#/api/catalog-json';
import { requestClient } from '#/api/request';

export function normalizeProductQuery(query: ProductQuery = {}) {
  const page = Number.isFinite(query.page)
    ? Math.max(1, Math.trunc(query.page ?? 1))
    : 1;
  return {
    category_id: query.category_id,
    cursor: query.cursor || undefined,
    page: query.cursor ? undefined : page,
    page_size: Number.isFinite(query.page_size)
      ? Math.min(100, Math.max(1, Math.trunc(query.page_size ?? 20)))
      : 20,
    sort: query.sort || '-updated_at',
    status: query.status || undefined,
  };
}

export function getProductsApi(query: ProductQuery, config?: ApiRequestConfig) {
  return requestClient.get<ProductPage>('/admin/products', {
    ...config,
    params: normalizeProductQuery(query),
    transformResponse: [parseCatalogJSON],
  });
}

export function getCategoriesApi(config?: ApiRequestConfig) {
  return requestClient.get<Category[]>('/admin/categories', {
    ...config,
    transformResponse: [parseCatalogJSON],
  });
}

export function getProductApi(id: CatalogID, config?: ApiRequestConfig) {
  return requestClient.get<ProductDetail>(
    `/admin/products/${encodeURIComponent(id)}`,
    {
      ...config,
      transformResponse: [parseCatalogJSON],
    },
  );
}

export function exportProductsApi(
  filters: ProductFilters,
  sort: ProductSort,
  key: string,
  config?: ApiRequestConfig,
) {
  return requestClient.post<ProductExport>(
    '/admin/products/export',
    { filters, sort },
    {
      ...config,
      headers: { 'Idempotency-Key': key },
      transformResponse: [parseCatalogJSON],
    },
  );
}
