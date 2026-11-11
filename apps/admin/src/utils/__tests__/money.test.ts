import { describe, expect, it } from 'vitest';

import { formatCents, formatPriceRange } from '../money';

describe('integer cents display', () => {
  it('preserves two decimal places without floating point arithmetic', () => {
    expect(formatCents(12_345)).toBe('123.45');
    expect(formatCents(0)).toBe('0.00');
    expect(formatCents(1)).toBe('0.01');
    expect(formatCents(-1)).toBe('-0.01');
    expect(formatCents('9223372036854775807')).toBe('92233720368547758.07');
    expect(formatCents('-9223372036854775808')).toBe('-92233720368547758.08');
  });

  it('shows a dash for missing, fractional or already imprecise values', () => {
    for (const value of [
      undefined,
      null,
      '',
      '1.23',
      1.23,
      Number.NaN,
      2 ** 53,
    ]) {
      expect(formatCents(value)).toBe('—');
    }
    expect(formatPriceRange(0, 12_345)).toBe('0.00 – 123.45');
    expect(formatPriceRange(null, 0)).toBe('— – 0.00');
    expect(formatPriceRange(undefined, undefined)).toBe('—');
  });
});
