import type { Cents } from '#/api/model/catalog';

export function formatCents(value?: Cents | null): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'number' && !Number.isSafeInteger(value)) return '—';
  const text = String(value);
  if (!/^-?\d+$/.test(text)) return '—';
  const integer = BigInt(text).toString();
  const negative = integer.startsWith('-');
  const digits = (negative ? integer.slice(1) : integer).padStart(3, '0');
  return `${negative ? '-' : ''}${digits.slice(0, -2)}.${digits.slice(-2)}`;
}

export function formatPriceRange(
  min?: Cents | null,
  max?: Cents | null,
): string {
  const lower = formatCents(min);
  const upper = formatCents(max);
  return lower === upper ? lower : `${lower} – ${upper}`;
}
