import type { ApiRequestConfig } from '#/api/client';
import type { PageResult } from '#/api/model/response';
import type { FilePurpose, LibraryFile } from '#/api/model/storage';

import { requestClient } from '#/api/request';

const read: ApiRequestConfig = { silent: true, preserveBusinessMessage: true };
export const getFilesApi = (
  page: number,
  pageSize: number,
  filters: { keyword?: string; purpose?: FilePurpose },
) =>
  requestClient.get<PageResult<LibraryFile>>('/admin/files', {
    ...read,
    params: { page, page_size: pageSize, ...filters },
  });
export function uploadFileApi(
  file: File,
  purpose: FilePurpose,
  progress: (percent: number) => void,
  signal?: AbortSignal,
) {
  const data = new FormData();
  data.append('purpose', purpose);
  data.append('file', file);
  return requestClient.post<LibraryFile>('/admin/files', data, {
    ...read,
    signal,
    timeout: 120_000,
    headers: {
      'Content-Type': undefined,
      'Idempotency-Key': crypto.randomUUID(),
    },
    onUploadProgress: (event) => {
      if (event.total)
        progress(Math.min(99, Math.round((event.loaded * 100) / event.total)));
    },
  });
}
export const downloadFileApi = (id: number) =>
  requestClient.get<Blob>(`/admin/files/${id}`, {
    ...read,
    responseType: 'blob',
    timeout: 120_000,
  });
export const getFileUrlApi = (id: number) =>
  requestClient.get<{ expires_in: number; url: string }>(
    `/admin/files/${id}/url`,
    read,
  );
export const deleteFileApi = (id: number) =>
  requestClient.delete(`/admin/files/${id}`, {
    ...read,
    headers: { 'Idempotency-Key': crypto.randomUUID() },
  });
