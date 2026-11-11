import type { PageResult } from './response';

export type CatalogID = number | string;
export type Cents = number | string;
export type ProductStatus = 'active' | 'archived' | 'draft';
export type ProductSort =
  | '-price_min_cents'
  | '-updated_at'
  | 'price_min_cents'
  | 'updated_at';

export interface Category {
  id: CatalogID;
  name: string;
  parent_id: CatalogID;
  sort: number;
  status?: string;
}

export interface ProductSummary {
  category_id?: CatalogID | null;
  id: CatalogID;
  main_image?: null | string;
  price_max_cents?: Cents | null;
  price_min_cents?: Cents | null;
  sku_count?: null | number;
  status?: null | string;
  title?: null | string;
  updated_at?: null | string;
}

export interface Product extends ProductSummary {
  brand?: null | string;
  code?: null | string;
  created_at?: null | string;
  subtitle?: null | string;
}

export interface ProductSKU {
  attributes?: null | Record<string, unknown>;
  code?: null | string;
  currency?: null | string;
  id: CatalogID;
  price_cents?: Cents | null;
  title?: null | string;
}

export interface ProductListing {
  external_product_id?: null | string;
  id: CatalogID;
  platform_id?: CatalogID | null;
  status?: null | string;
  synced_at?: null | string;
}

export interface ProductDetail {
  listings?: null | ProductListing[];
  product: Product;
  reported_stock?: Cents | null;
  skus?: null | ProductSKU[];
}

export interface ProductFilters {
  category_id?: CatalogID;
  status?: ProductStatus;
}

export interface ProductQuery extends ProductFilters {
  cursor?: string;
  page?: number;
  page_size?: number;
  sort?: ProductSort;
}

export interface ProductPage extends PageResult<ProductSummary> {
  next_cursor?: string;
}

export interface ProductExport {
  export_id: CatalogID;
  status: string;
}
