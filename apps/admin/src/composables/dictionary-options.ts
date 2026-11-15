export interface DictionaryOption {
  color?: string;
  label: string;
  value: string;
}

// Minimum form options also bootstrap dictionary maintenance without metadata.
export const enableStatusOptions: DictionaryOption[] = [
  { label: '启用', value: 'active' },
  { label: '停用', value: 'disabled' },
];
export const userStatusOptions: DictionaryOption[] = [
  ...enableStatusOptions,
  { label: '锁定', value: 'locked' },
];
export const productStatusOptions: DictionaryOption[] = [
  { label: '草稿', value: 'draft' },
  { label: '在售', value: 'active' },
  { label: '已归档', value: 'archived' },
];
