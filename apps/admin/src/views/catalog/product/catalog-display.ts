import type { CatalogID, Category, ProductStatus } from '#/api/model/catalog';

export interface CategoryOption {
  children?: CategoryOption[];
  label: string;
  value: CatalogID;
}

export const productStatusValues: ProductStatus[] = [
  'active',
  'archived',
  'draft',
];

export const productSortOptions = [
  { label: '更新时间：由新到旧', value: '-updated_at' },
  { label: '更新时间：由旧到新', value: 'updated_at' },
  { label: '价格：由低到高', value: 'price_min_cents' },
  { label: '价格：由高到低', value: '-price_min_cents' },
];

export function categoryOptions(categories: Category[]): CategoryOption[] {
  const nodes = new Map<string, CategoryOption>(
    categories.map((item) => [
      String(item.id),
      {
        label: item.name,
        value: item.id,
      },
    ]),
  );
  const roots: CategoryOption[] = [];
  for (const category of categories.toSorted((a, b) => a.sort - b.sort)) {
    const node = nodes.get(String(category.id));
    if (!node) continue;
    const parent = nodes.get(String(category.parent_id));
    if (parent && parent !== node) (parent.children ??= []).push(node);
    else roots.push(node);
  }
  return roots;
}

export function categoryLabel(
  categories: Category[],
  id?: CatalogID | null,
): string {
  return categories.find((item) => String(item.id) === String(id))?.name || '—';
}

export function displayText(value: unknown): string {
  switch (typeof value) {
    case 'string': {
      return value || '—';
    }
    case 'number':
    case 'bigint':
    case 'boolean': {
      return String(value);
    }
    case 'object': {
      return value === null ? '—' : JSON.stringify(value);
    }
    default: {
      return '—';
    }
  }
}
