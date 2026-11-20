import type { ApiRequestConfig } from '#/api/client';
import type { StorageInput, StorageProvider } from '#/api/model/storage';

import { requestClient } from '#/api/request';

const read: ApiRequestConfig = { silent: true };
const write = (): ApiRequestConfig => ({
  silent: true,
  preserveBusinessMessage: true,
  headers: { 'Idempotency-Key': crypto.randomUUID() },
});

export const getStorageProvidersApi = () =>
  requestClient.get<StorageProvider[]>('/admin/storage-providers', read);
export const saveStorageProviderApi = (input: StorageInput, id?: number) =>
  id
    ? requestClient.put<StorageProvider>(
        `/admin/storage-providers/${id}`,
        input,
        write(),
      )
    : requestClient.post<StorageProvider>(
        '/admin/storage-providers',
        input,
        write(),
      );
export const testStorageProviderApi = (id: number) =>
  requestClient.post<{ status: string }>(
    `/admin/storage-providers/${id}/test`,
    undefined,
    write(),
  );
export const defaultStorageProviderApi = (id: number) =>
  requestClient.post<StorageProvider>(
    `/admin/storage-providers/${id}/default`,
    undefined,
    write(),
  );
export const deleteStorageProviderApi = (id: number) =>
  requestClient.delete(`/admin/storage-providers/${id}`, write());
