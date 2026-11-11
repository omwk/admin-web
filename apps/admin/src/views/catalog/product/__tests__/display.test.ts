import { describe, expect, it } from 'vitest';

import { parseCatalogJSON } from '#/api/catalog-json';

import {
  categoryLabel,
  categoryOptions,
  displayText,
} from '../catalog-display';

describe('catalog response display', () => {
  it('parses int64 without rounding, leaving strings and decimals intact', () => {
    expect(
      parseCatalogJSON(
        String.raw`{"price_cents":9223372036854775807,"title":"9223372036854775807 \"quoted\"","small":12345,"ratio":0.5}`,
      ),
    ).toEqual({
      price_cents: '9223372036854775807',
      title: '9223372036854775807 "quoted"',
      small: 12_345,
      ratio: 0.5,
    });
  });

  it('builds the observed flat parent_id categories into a selectable tree', () => {
    const categories = [
      { id: 6, name: '手机配件', parent_id: 1, sort: 1 },
      { id: 1, name: '电子产品', parent_id: 0, sort: 1 },
    ];
    expect(categoryOptions(categories)).toEqual([
      {
        label: '电子产品',
        value: 1,
        children: [{ label: '手机配件', value: 6 }],
      },
    ]);
    expect(categoryLabel(categories, 6)).toBe('手机配件');
    expect(categoryLabel(categories, null)).toBe('—');
    expect(displayText(0)).toBe('0');
    expect(displayText('')).toBe('—');
  });
});
