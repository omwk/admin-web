import { describe, expect, it } from 'vitest';

import { ApiError } from '#/api/errors';

import {
  fileType,
  MAX_FILE_SIZE,
  normalizeUploadFile,
  uploadError,
  validateFile,
} from '../options';

describe('file upload boundaries', () => {
  it('normalizes Windows MIME aliases while preserving filename, bytes and modification time', async () => {
    for (const [name, type, canonical] of [
      ['data.csv', 'application/vnd.ms-excel', 'text/csv'],
      ['archive.zip', 'application/x-zip-compressed', 'application/zip'],
      ['config.yaml', 'application/x-yaml', 'application/yaml'],
      ['config.yml', 'text/x-yaml', 'text/yaml'],
      ['readme.md', 'text/x-markdown', 'text/markdown'],
      ['favicon.ico', 'image/vnd.microsoft.icon', 'image/x-icon'],
      ['picture.bmp', 'image/x-ms-bmp', 'image/bmp'],
    ] as const) {
      const original = new File(['original bytes'], name, {
        type,
        lastModified: 123,
      });
      const file = normalizeUploadFile(original);
      expect(file.type).toBe(canonical);
      expect(file.name).toBe(name);
      expect(file.lastModified).toBe(123);
      expect(await file.text()).toBe('original bytes');
      expect(validateFile(file)).toBe('');
    }
    const html = new File(['html'], 'disguised.txt', { type: 'text/html' });
    expect(normalizeUploadFile(html)).toBe(html);
    expect(validateFile(normalizeUploadFile(html))).toContain('text/html');
    const mismatched = new File(['data'], 'invalid.txt', {
      type: 'application/vnd.ms-excel',
    });
    expect(validateFile(normalizeUploadFile(mismatched))).toContain('不支持');
  });

  it.each([
    'jpg',
    'jpeg',
    'png',
    'webp',
    'gif',
    'bmp',
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
    'xml',
    'yaml',
    'yml',
    'ndjson',
    'jsonl',
  ])('allows .%s with no browser MIME', (extension) => {
    expect(validateFile(new File(['payload'], `file.${extension}`))).toBe('');
  });

  it('rejects oversized, empty and unsupported files before sending bytes', () => {
    expect(
      validateFile({
        name: 'big.txt',
        size: MAX_FILE_SIZE + 1,
        type: 'text/plain',
      }),
    ).toContain('20 MB');
    expect(validateFile(new File([], 'empty.txt'))).toContain('不能为空');
    expect(
      validateFile(new File(['html'], 'file.html', { type: 'text/html' })),
    ).toContain('不支持');
    expect(
      validateFile(new File(['html'], 'file.txt', { type: 'text/html' })),
    ).toContain('text/html');
    expect(
      validateFile({
        name: 'limit.TXT',
        size: MAX_FILE_SIZE,
        type: 'text/plain',
      }),
    ).toBe('');
  });

  it('keeps backend rejection text and allowed types instead of generic invalid-param text', () => {
    const error = new ApiError({
      status: 400,
      code: 10_001,
      message: '不支持的文件类型：text/html',
      details: { allowed: ['image/png', 'text/plain'] },
    });
    expect(uploadError(error)).toContain('不支持的文件类型：text/html');
    expect(uploadError(error)).toContain('image/png');
    expect(
      uploadError(
        new ApiError({ status: 413, message: '文件超过 20 MB 上限' }),
      ),
    ).toBe('文件超过 20 MB 上限');
    expect(
      uploadError(new ApiError({ status: 500, message: 'private internals' })),
    ).not.toContain('private internals');
  });

  it('labels extended types by extension when the server sniffs plain text', () => {
    expect(fileType({ original_name: 'config.json', mime: 'text/plain' })).toBe(
      'JSON',
    );
    expect(
      fileType({ original_name: 'data.xlsx', mime: 'application/zip' }),
    ).toBe('Excel');
    expect(fileType({ original_name: 'logo.svg', mime: 'image/svg+xml' })).toBe(
      '图片',
    );
  });
});
