import type { LibraryFile } from '#/api/model/storage';

import { toApiError } from '#/api/errors';

export const MAX_FILE_SIZE = 20 * 1024 * 1024;
const extensions = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
  'bmp',
  'tif',
  'tiff',
  'ico',
  'svg',
  'pdf',
  'csv',
  'xlsx',
  'zip',
  'txt',
  'md',
  'json',
  'log',
  'ndjson',
  'jsonl',
  'xml',
  'yaml',
  'yml',
];
export const fileAccept = extensions
  .map((extension) => `.${extension}`)
  .join(',');
export const fileHint =
  '支持图片、PDF、CSV、XLSX、ZIP、txt、md、json、log、xml、yaml，单个文件不超过 20 MB。';
const mimes = new Set([
  '',
  'application/json',
  'application/octet-stream',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/x-ndjson',
  'application/xml',
  'application/yaml',
  'application/zip',
  'image/bmp',
  'image/gif',
  'image/jpeg',
  'image/png',
  'image/svg+xml',
  'image/tiff',
  'image/webp',
  'image/x-icon',
  'text/csv',
  'text/markdown',
  'text/plain',
  'text/xml',
  'text/yaml',
]);
export const purposeOptions = [
  { value: 'attachment', label: '附件' },
  { value: 'export', label: '导出' },
  { value: 'shop', label: '店铺' },
  { value: 'snapshot', label: '快照' },
];
const mimeAliases: Record<string, { extensions: string[]; type: string }> = {
  'application/vnd.ms-excel': { extensions: ['csv'], type: 'text/csv' },
  'application/x-zip-compressed': {
    extensions: ['zip'],
    type: 'application/zip',
  },
  'application/x-yaml': {
    extensions: ['yaml', 'yml'],
    type: 'application/yaml',
  },
  'text/x-yaml': { extensions: ['yaml', 'yml'], type: 'text/yaml' },
  'text/x-markdown': { extensions: ['md'], type: 'text/markdown' },
  'image/vnd.microsoft.icon': { extensions: ['ico'], type: 'image/x-icon' },
  'image/x-ms-bmp': { extensions: ['bmp'], type: 'image/bmp' },
};
export function normalizeUploadFile(file: File) {
  const type = file.type.toLowerCase().split(';')[0]?.trim() ?? '';
  const alias = mimeAliases[type];
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!alias?.extensions.includes(extension)) return file;
  return new File([file], file.name, {
    type: alias.type,
    lastModified: file.lastModified,
  });
}
export function validateFile(file: Pick<File, 'name' | 'size' | 'type'>) {
  if (file.size === 0) return '文件不能为空';
  if (file.size > MAX_FILE_SIZE) return '文件超过 20 MB 上限';
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  if (!extensions.includes(extension))
    return `不支持的文件扩展名：${extension || '无扩展名'}`;
  if (!mimes.has(file.type.toLowerCase().split(';')[0]?.trim() ?? ''))
    return `不支持的文件类型：${file.type}`;
  return '';
}
export function uploadError(failure: unknown) {
  const error = toApiError(failure);
  const text = [400, 409, 413].includes(error.status ?? 0)
    ? error.businessMessage || error.message
    : error.message;
  const allowed = Array.isArray(error.details?.allowed)
    ? error.details.allowed.filter(
        (item): item is string => typeof item === 'string',
      )
    : [];
  return allowed.length > 0
    ? `${text}；允许的类型：${allowed.join('、')}`
    : text;
}
export function fileType(file: Pick<LibraryFile, 'mime' | 'original_name'>) {
  const extension = file.original_name.split('.').pop()?.toLowerCase() ?? '';
  const labels: Record<string, string> = {
    pdf: 'PDF',
    csv: 'CSV',
    xlsx: 'Excel',
    zip: 'ZIP',
    txt: '文本',
    md: 'Markdown',
    json: 'JSON',
    log: '日志',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    jsonl: 'JSONL',
    ndjson: 'NDJSON',
  };
  return file.mime.startsWith('image/')
    ? '图片'
    : (labels[extension] ?? file.mime);
}
export function fileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  return bytes < 1024 * 1024
    ? `${(bytes / 1024).toFixed(1)} KB`
    : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}
