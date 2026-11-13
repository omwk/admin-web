import type { ApiRequestConfig } from '#/api/client';
import type {
  Dictionary,
  DictionaryInput,
  DictionaryItem,
  DictionaryItemInput,
  DictionaryScope,
  MetaDictionaryItem,
} from '#/api/model/configuration';
import type { PageResult } from '#/api/model/response';

import { requestClient } from '#/api/request';

const read: ApiRequestConfig = { silent: true };
const write: ApiRequestConfig = { silent: true, preserveBusinessMessage: true };

export const getDictionariesApi = (
  scope: DictionaryScope,
  page = 1,
  pageSize = 100,
) =>
  requestClient.get<PageResult<Dictionary>>('/admin/dicts', {
    ...read,
    params: { scope, page, page_size: pageSize },
  });

export async function getAllDictionariesApi(scope: DictionaryScope) {
  const dictionaries: Dictionary[] = [];
  for (let page = 1; ; page++) {
    const result = await getDictionariesApi(scope, page);
    dictionaries.push(...result.list);
    if (result.list.length === 0 || dictionaries.length >= result.total)
      return dictionaries;
  }
}
export const createDictionaryApi = (input: DictionaryInput) =>
  requestClient.post<Dictionary>('/admin/dicts', input, write);
export const updateDictionaryApi = (id: number, input: DictionaryInput) =>
  requestClient.put<Dictionary>(`/admin/dicts/${id}`, input, write);
export const deleteDictionaryApi = (id: number) =>
  requestClient.delete(`/admin/dicts/${id}`, write);
export const getDictionaryItemsApi = (id: number, page = 1, pageSize = 20) =>
  requestClient.get<PageResult<DictionaryItem>>(`/admin/dicts/${id}/items`, {
    ...read,
    params: { page, page_size: pageSize },
  });
export const createDictionaryItemApi = (
  id: number,
  input: DictionaryItemInput,
) =>
  requestClient.post<DictionaryItem>(`/admin/dicts/${id}/items`, input, write);
export const updateDictionaryItemApi = (
  id: number,
  input: DictionaryItemInput,
) => requestClient.put<DictionaryItem>(`/admin/dict-items/${id}`, input, write);
export const deleteDictionaryItemApi = (id: number) =>
  requestClient.delete(`/admin/dict-items/${id}`, write);
export const getMetaDictionaryApi = (type: string) =>
  requestClient.get<MetaDictionaryItem[]>(
    `/meta/dicts/${encodeURIComponent(type)}`,
    read,
  );
