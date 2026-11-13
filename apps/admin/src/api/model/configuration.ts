export type DictionaryScope = 'business' | 'system';
export type DictionaryStatus = 'active' | 'disabled';

export interface DictionaryInput {
  name: string;
  status: DictionaryStatus;
  type: string;
}
export interface Dictionary extends DictionaryInput {
  builtin: boolean;
  id: number;
  scope: DictionaryScope;
  tenant_id: number;
}
export interface DictionaryItemInput {
  color: string;
  extra: Record<string, unknown>;
  label: string;
  sort: number;
  status: DictionaryStatus;
  value: string;
}
export interface DictionaryItem extends DictionaryItemInput {
  builtin: boolean;
  dict_id: number;
  id: number;
  tenant_id: number;
}
export interface MetaDictionaryItem {
  color: string;
  extra: Record<string, unknown>;
  label: string;
  scope: DictionaryScope;
  sort: number;
  value: string;
}
export interface SettingSchema {
  default: unknown;
  desc: string;
  enum?: string[];
  group: string;
  hot_reload: boolean;
  key: string;
  max?: number;
  min?: number;
  read_only: boolean;
  type: 'boolean' | 'json' | 'number' | 'string';
}
export interface SettingItem {
  schema: SettingSchema;
  value: unknown;
}
export interface SettingGroup {
  group: string;
  items: SettingItem[];
}
