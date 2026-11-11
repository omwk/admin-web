import { useAccessStore } from '@vben/stores';

export type CatalogAction = 'export' | 'list' | 'read';

/** Explicit correspondence with the live OpenAPI; never infer one grant from another. */
export function allowsCatalog(codes: string[], action: CatalogAction): boolean {
  return (
    codes.includes(`catalog:product:${action}`) ||
    codes.includes(`product:spu:${action}`)
  );
}

export function hasCatalogPermission(action: CatalogAction): boolean {
  return allowsCatalog(useAccessStore().accessCodes, action);
}
