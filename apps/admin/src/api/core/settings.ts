import type { ApiRequestConfig } from '#/api/client';
import type { SettingGroup } from '#/api/model/configuration';

import { requestClient } from '#/api/request';

const read: ApiRequestConfig = { silent: true };
const write: ApiRequestConfig = { silent: true, preserveBusinessMessage: true };
export const getSettingsApi = () =>
  requestClient.get<SettingGroup[]>('/admin/settings', read);
export const getSettingGroupApi = (group: string) =>
  requestClient.get<SettingGroup>(
    `/admin/settings/${encodeURIComponent(group)}`,
    read,
  );
export const updateSettingGroupApi = (
  group: string,
  changes: Record<string, unknown>,
) =>
  requestClient.put<SettingGroup>(
    `/admin/settings/${encodeURIComponent(group)}`,
    changes,
    write,
  );
