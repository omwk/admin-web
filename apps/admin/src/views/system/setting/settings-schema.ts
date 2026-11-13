import type { SettingGroup, SettingSchema } from '#/api/model/configuration';

export type SettingDraft = Record<string, boolean | null | number | string>;

export function settingDraft(group: SettingGroup): SettingDraft {
  const draft: SettingDraft = {};
  for (const { schema, value } of group.items) {
    if (schema.type === 'json')
      draft[schema.key] = JSON.stringify(value, null, 2) ?? 'null';
    else if (
      typeof value === 'number' ||
      typeof value === 'boolean' ||
      typeof value === 'string'
    )
      draft[schema.key] = value;
    else draft[schema.key] = null;
  }
  return draft;
}

export function settingRange(schema: SettingSchema) {
  if (schema.enum?.length) return `可选值：${schema.enum.join(' / ')}`;
  const bounds =
    schema.min === undefined && schema.max === undefined
      ? ''
      : `，范围 ${schema.min ?? '不限'}–${schema.max ?? '不限'}`;
  if (schema.type === 'number') return `整数${bounds}`;
  if (schema.type === 'string' && bounds) return `字符数${bounds}`;
  if (schema.type === 'json') return '有效 JSON';
  return '';
}

function validate(schema: SettingSchema, value: SettingDraft[string]): string {
  if (schema.type === 'number') {
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      !Number.isInteger(value)
    )
      return '请输入整数';
    if (
      (schema.min !== undefined && value < schema.min) ||
      (schema.max !== undefined && value > schema.max)
    )
      return settingRange(schema);
  } else if (schema.type === 'boolean') {
    if (typeof value !== 'boolean') return '请选择开关值';
  } else if (schema.type === 'string') {
    if (typeof value !== 'string') return '请输入文本';
    // Match Go utf8.RuneCountInString: bounds count Unicode code points.
    const size = value.match(/./gsu)?.length ?? 0;
    if (
      (schema.min !== undefined && size < schema.min) ||
      (schema.max !== undefined && size > schema.max)
    )
      return settingRange(schema);
    if (schema.enum && !schema.enum.includes(value))
      return settingRange(schema);
    if (schema.key === 'timezone') {
      try {
        Intl.DateTimeFormat('en', { timeZone: value }).resolvedOptions();
      } catch {
        return '请输入有效的 IANA 时区名称';
      }
    }
  } else {
    try {
      if (JSON.parse(String(value)) === null) return 'JSON 配置不可为空';
    } catch {
      return '请输入有效 JSON';
    }
  }
  return '';
}

export function validateSettings(
  group: SettingGroup,
  draft: SettingDraft,
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const { schema } of group.items) {
    if (schema.read_only) continue;
    const error = validate(schema, draft[schema.key] ?? null);
    if (error) errors[schema.key] = error;
  }
  return errors;
}

export function settingChanges(
  group: SettingGroup,
  draft: SettingDraft,
): Record<string, unknown> {
  const changes: Record<string, unknown> = {};
  for (const { schema, value } of group.items) {
    if (schema.read_only) continue;
    const next =
      schema.type === 'json'
        ? JSON.parse(String(draft[schema.key]))
        : draft[schema.key];
    if (JSON.stringify(next) !== JSON.stringify(value))
      changes[schema.key] = next;
  }
  return changes;
}
