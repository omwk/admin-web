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

export interface FieldDiff {
  key: string;
  field: string;
  before: JsonValue | undefined;
  after: JsonValue | undefined;
  change: 'added' | 'changed' | 'removed';
}
export interface AuditDiff {
  kind: 'created' | 'deleted' | 'empty' | 'unchanged' | 'updated';
  fields: FieldDiff[];
}

function record(
  value: JsonValue | undefined,
): value is { [key: string]: JsonValue } {
  return object(value) && !Array.isArray(value);
}
function empty(value: JsonValue | undefined): boolean {
  return (
    value === null ||
    value === undefined ||
    (object(value) && Object.keys(value).length === 0)
  );
}
function fieldName(path: string[]): string {
  let label = '';
  for (const key of path)
    label += /^[a-z_]\w*$/i.test(key)
      ? `${label ? '.' : ''}${key}`
      : `[${JSON.stringify(key)}]`;
  return label || '$';
}
function fields(
  before: JsonValue | undefined,
  after: JsonValue | undefined,
  path: string[] = [],
): FieldDiff[] {
  if (equal(before, after)) return [];
  if (
    (record(before) && record(after)) ||
    (path.length === 0 &&
      (before === undefined || after === undefined) &&
      (record(before) || record(after)))
  ) {
    const keys = new Set([
      ...Object.keys(before ?? {}),
      ...Object.keys(after ?? {}),
    ]);
    return [...keys].flatMap((key) =>
      fields(
        record(before) && Object.hasOwn(before, key) ? before[key] : undefined,
        record(after) && Object.hasOwn(after, key) ? after[key] : undefined,
        [...path, key],
      ),
    );
  }
  let change: FieldDiff['change'] = 'changed';
  if (before === undefined) change = 'added';
  else if (after === undefined) change = 'removed';
  return [
    {
      key: JSON.stringify(path),
      field: fieldName(path),
      before,
      after,
      change,
    },
  ];
}

export function auditDiff(before: JsonValue, after: JsonValue): AuditDiff {
  const oldValue = empty(before) ? undefined : before;
  const newValue = empty(after) ? undefined : after;
  if (oldValue === undefined && newValue === undefined)
    return { kind: 'empty', fields: [] };
  if (equal(oldValue, newValue)) return { kind: 'unchanged', fields: [] };
  let kind: AuditDiff['kind'] = 'updated';
  if (oldValue === undefined) kind = 'created';
  else if (newValue === undefined) kind = 'deleted';
  return { kind, fields: fields(oldValue, newValue) };
}
