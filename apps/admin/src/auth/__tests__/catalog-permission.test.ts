import { describe, expect, it } from 'vitest';

import { allowsCatalog } from '../catalog-permission';

describe('catalog access boundaries', () => {
  it('recognizes each canonical or verified backend grant independently', () => {
    for (const namespace of ['catalog:product', 'product:spu']) {
      expect(allowsCatalog([`${namespace}:list`], 'list')).toBe(true);
      expect(allowsCatalog([`${namespace}:list`], 'read')).toBe(false);
      expect(allowsCatalog([`${namespace}:read`], 'list')).toBe(false);
      expect(allowsCatalog([`${namespace}:read`], 'export')).toBe(false);
      expect(allowsCatalog([`${namespace}:export`], 'export')).toBe(true);
    }
    expect(allowsCatalog(['product:spu:*'], 'list')).toBe(false);
    expect(allowsCatalog([], 'list')).toBe(false);
  });

  it('does not infer detail permission from list permission', () => {
    expect(allowsCatalog(['product:spu:list'], 'read')).toBe(false);
    expect(allowsCatalog(['product:spu:read'], 'list')).toBe(false);
  });
});
