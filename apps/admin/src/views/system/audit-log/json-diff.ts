import type { JsonValue } from '#/api/model/audit';

export interface DiffNode {
  key: string;
  title: string;
  change: 'added' | 'changed' | 'removed' | 'same';
  children?: DiffNode[];
}

function object(
  value: JsonValue | undefined,
): value is JsonValue[] | { [key: string]: JsonValue } {
  return value !== null && typeof value === 'object';
}
function equal(a: JsonValue | undefined, b: JsonValue | undefined): boolean {
  if (Object.is(a, b)) return true;
  if (!object(a) || !object(b) || Array.isArray(a) !== Array.isArray(b))
    return false;
  const entries = Object.entries(a);
  const other = new Map(Object.entries(b));
  return (
    entries.length === other.size &&
    entries.every(
      ([key, value]) => other.has(key) && equal(value, other.get(key)),
    )
  );
}
function tree(
  value: JsonValue,
  other: JsonValue | undefined,
  exists: boolean,
  side: 'after' | 'before',
  key = '$',
  label = '$',
): DiffNode {
  let change: DiffNode['change'] = 'same';
  if (!exists) change = side === 'before' ? 'removed' : 'added';
  else if (!equal(value, other)) change = 'changed';
  let content = JSON.stringify(value);
  if (Array.isArray(value)) content = `[${value.length}]`;
  else if (object(value)) content = '{…}';
  const title = `${label}: ${content}`;
  const node: DiffNode = { key, title, change };
  if (object(value)) {
    const comparable =
      object(other) && Array.isArray(value) === Array.isArray(other);
    node.children = Object.entries(value).map(([name, entry]) => {
      const present = comparable && Object.hasOwn(other, name);
      return tree(
        entry,
        present ? (other as Record<string, JsonValue>)[name] : undefined,
        present,
        side,
        `${key}/${name.replaceAll('~', '~0').replaceAll('/', '~1')}`,
        Array.isArray(value) ? `[${name}]` : name,
      );
    });
  }
  return node;
}
export function diffTrees(before: JsonValue, after: JsonValue) {
  return {
    before: [tree(before, after, true, 'before')],
    after: [tree(after, before, true, 'after')],
  };
}
