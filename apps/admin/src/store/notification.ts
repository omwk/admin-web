import { ref } from 'vue';

import { defineStore } from 'pinia';

import { getUnreadCountApi } from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';
import { getSessionVersion } from '#/auth/token';

export const useNotificationStore = defineStore('notification', () => {
  const count = ref(0);
  const error = ref('');
  let sequence = 0;
  async function refresh() {
    const request = ++sequence;
    const session = getSessionVersion();
    try {
      const result = await getUnreadCountApi();
      if (request === sequence && session === getSessionVersion()) {
        count.value = result.count;
        error.value = '';
      }
    } catch (error_) {
      if (request === sequence && session === getSessionVersion())
        error.value = notificationError(error_);
    }
  }
  function clear() {
    sequence++;
    count.value = 0;
    error.value = '';
  }
  return { clear, count, error, refresh };
});
