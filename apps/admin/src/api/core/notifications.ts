import type { ApiRequestConfig } from '#/api/client';
import type {
  NotificationDelivery,
  NotificationInbox,
  NotificationPreference,
  NotificationPreferenceView,
  NotificationProvider,
  NotificationProviderInput,
  NotificationTemplate,
  NotificationTemplateInput,
} from '#/api/model/notification';
import type { PageResult } from '#/api/model/response';

import { safeProviderConfig } from '#/api/notification-safety';
import { requestClient } from '#/api/request';

const base = '/admin/notifications';
const silent: ApiRequestConfig = { silent: true };
export const getNotificationsApi = (params: {
  page: number;
  page_size: number;
  template?: string;
  unread?: boolean;
}) =>
  requestClient.get<PageResult<NotificationInbox>>(base, { ...silent, params });
export const getUnreadCountApi = () =>
  requestClient.get<{ count: number }>(`${base}/unread-count`, silent);
export const readNotificationApi = (id: number) =>
  requestClient.put(`${base}/${id}/read`, undefined, silent);
export const readAllNotificationsApi = () =>
  requestClient.post<{ updated: number }>(
    `${base}/read-all`,
    undefined,
    silent,
  );
export const getNotificationPreferencesApi = () =>
  requestClient.get<{ preferences: NotificationPreferenceView[] }>(
    `${base}/preferences`,
    silent,
  );
export const saveNotificationPreferencesApi = (
  preferences: NotificationPreference[],
) =>
  requestClient.put<{ preferences: NotificationPreferenceView[] }>(
    `${base}/preferences`,
    { preferences },
    silent,
  );

function providerView(provider: NotificationProvider): NotificationProvider {
  return { ...provider, config: safeProviderConfig(provider.config ?? {}) };
}
export async function getNotificationProvidersApi(page = 1, pageSize = 20) {
  const result = await requestClient.get<PageResult<NotificationProvider>>(
    `${base}/providers`,
    {
      ...silent,
      params: { page, page_size: pageSize },
    },
  );
  return {
    ...result,
    list: (result.list ?? []).map((value) => providerView(value)),
  };
}
export async function saveNotificationProviderApi(
  input: NotificationProviderInput,
  id?: number,
) {
  const result =
    id === undefined
      ? await requestClient.post<NotificationProvider>(
          `${base}/providers`,
          input,
          silent,
        )
      : await requestClient.put<NotificationProvider>(
          `${base}/providers/${id}`,
          input,
          silent,
        );
  return providerView(result);
}
export const deleteNotificationProviderApi = (id: number) =>
  requestClient.delete(`${base}/providers/${id}`, silent);
export const testNotificationProviderApi = (id: number) =>
  requestClient.post<NotificationDelivery>(
    `${base}/providers/${id}/test`,
    undefined,
    silent,
  );
export const getNotificationTemplatesApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<NotificationTemplate>>(`${base}/templates`, {
    ...silent,
    params: { page, page_size: pageSize },
  });
export const saveNotificationTemplateApi = (
  code: string,
  input: NotificationTemplateInput,
) =>
  requestClient.put<NotificationTemplate>(
    `${base}/templates/${encodeURIComponent(code)}`,
    input,
    silent,
  );
export const getNotificationDeliveriesApi = (page = 1, pageSize = 20) =>
  requestClient.get<PageResult<NotificationDelivery>>(`${base}/deliveries`, {
    ...silent,
    params: { page, page_size: pageSize },
  });
export const retryNotificationDeliveryApi = (id: number) =>
  requestClient.post<NotificationDelivery>(
    `${base}/deliveries/${id}/retry`,
    undefined,
    silent,
  );
