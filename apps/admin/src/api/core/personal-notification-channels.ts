import type { ApiRequestConfig } from '#/api/client';
import type {
  NotificationDelivery,
  PersonalNotificationChannel,
  PersonalNotificationChannelView,
} from '#/api/model/notification';

import { requestClient } from '#/api/request';

const base = '/auth/notification-channels';
const silent: ApiRequestConfig = { silent: true };

export const getPersonalNotificationChannelsApi = () =>
  requestClient.get<{ channels: PersonalNotificationChannelView[] }>(
    base,
    silent,
  );

export const savePersonalNotificationChannelApi = (
  channel: PersonalNotificationChannel,
  endpoint: string,
) =>
  requestClient.put<PersonalNotificationChannelView>(
    `${base}/${channel}`,
    { endpoint },
    silent,
  );

export const deletePersonalNotificationChannelApi = (
  channel: PersonalNotificationChannel,
) => requestClient.delete<undefined>(`${base}/${channel}`, silent);

export const testPersonalNotificationChannelApi = (
  channel: PersonalNotificationChannel,
) =>
  requestClient.post<NotificationDelivery>(
    `${base}/${channel}/test`,
    undefined,
    silent,
  );
