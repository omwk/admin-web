import type { NotificationBroadcastInput } from '#/api/model/notification';

import { computed, onUnmounted, reactive, ref, watch } from 'vue';

import { message, Modal } from 'ant-design-vue';

import { getUsersApi } from '#/api/core/admin-users';
import {
  createNotificationBroadcastApi,
  previewNotificationBroadcastApi,
} from '#/api/core/notifications';
import { getAllRolesApi } from '#/api/core/system';
import { notificationError } from '#/api/notification-safety';

import { channelLabel } from './options';

export function useBroadcastForm(sent: () => Promise<void>) {
  const form = reactive<NotificationBroadcastInput>({
    title: '',
    body: '',
    channels: ['inbox', 'email'],
    audience: { type: 'all' },
  });
  const roleIds = ref<number[]>([]);
  const userIds = ref<number[]>([]);
  const roles = ref<{ label: string; value: number }[]>([]);
  const users = ref<{ label: string; value: number }[]>([]);
  const lookupError = ref('');
  const loadingRoles = ref(false);
  const loadingUsers = ref(false);
  const error = ref('');
  const previewing = ref(false);
  const publishing = ref(false);
  const confirming = ref(false);
  const recipients = ref<number>();
  let sequence = 0;
  let userSequence = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let alive = true;
  let confirmation: ReturnType<typeof Modal.confirm> | undefined;
  const input = computed<NotificationBroadcastInput>(() => ({
    title: form.title.trim(),
    body: form.body,
    channels: [...form.channels],
    audience:
      form.audience.type === 'all'
        ? { type: 'all' }
        : {
            type: form.audience.type,
            ids: [
              ...(form.audience.type === 'roles'
                ? roleIds.value
                : userIds.value),
            ],
          },
  }));
  const locked = computed(() => publishing.value || confirming.value);
  watch(input, () => {
    sequence++;
    recipients.value = undefined;
    previewing.value = false;
    error.value = '';
  });
  async function loadRoles() {
    loadingRoles.value = true;
    lookupError.value = '';
    try {
      const result = await getAllRolesApi();
      if (alive)
        roles.value = result
          .filter((item) => item.status === 'active')
          .map((item) => ({ label: item.name, value: item.id }));
    } catch (error_) {
      if (alive) lookupError.value = notificationError(error_);
    } finally {
      if (alive) loadingRoles.value = false;
    }
  }
  function searchUsers(keyword = '') {
    const request = ++userSequence;
    clearTimeout(timer);
    loadingUsers.value = true;
    lookupError.value = '';
    timer = setTimeout(async () => {
      try {
        const result = await getUsersApi(
          { keyword, page_size: 100, status: 'active' },
          { silent: true },
        );
        if (!alive || request !== userSequence) return;
        const selected = users.value.filter((item) =>
          userIds.value.includes(item.value),
        );
        users.value = [
          ...new Map(
            [
              ...selected,
              ...result.list.map((item) => ({
                label: item.nickname
                  ? `${item.nickname}（${item.username}）`
                  : item.username,
                value: item.id,
              })),
            ].map((item) => [item.value, item]),
          ).values(),
        ];
      } catch (error_) {
        if (alive && request === userSequence)
          lookupError.value = notificationError(error_);
      } finally {
        if (alive && request === userSequence) loadingUsers.value = false;
      }
    }, 300);
  }
  watch(
    () => form.audience.type,
    (type) => {
      lookupError.value = '';
      if (type === 'roles') void loadRoles();
      if (type === 'users') searchUsers();
    },
  );
  function validate() {
    if (
      !input.value.title ||
      input.value.title.length > 128 ||
      /[\r\n]/.test(input.value.title)
    )
      return '请填写公告标题（最多 128 字，不可换行）';
    if (!input.value.body.trim() || input.value.body.length > 2000)
      return '请填写公告正文（最多 2000 字）';
    if (input.value.channels.length === 0) return '请至少选择一种渠道';
    if (
      input.value.audience.type !== 'all' &&
      !input.value.audience.ids?.length
    )
      return '请选择公告范围中的角色或用户';
    return '';
  }
  async function preview() {
    if (locked.value || previewing.value) return;
    error.value = validate();
    if (error.value) return;
    const request = ++sequence;
    const snapshot = JSON.stringify(input.value);
    previewing.value = true;
    try {
      const result = await previewNotificationBroadcastApi(input.value);
      if (
        alive &&
        request === sequence &&
        snapshot === JSON.stringify(input.value)
      )
        recipients.value = result.recipients;
    } catch (error_) {
      if (alive && request === sequence)
        error.value = notificationError(error_);
    } finally {
      if (alive && request === sequence) previewing.value = false;
    }
  }
  function publish() {
    if (locked.value || previewing.value) return;
    error.value = validate();
    if (error.value) return;
    if (recipients.value === undefined) {
      error.value = '请先预览当前公告的发送人数';
      return;
    }
    if (recipients.value === 0) {
      error.value = '当前范围没有可接收公告的用户';
      return;
    }
    const snapshot = input.value;
    confirming.value = true;
    confirmation = Modal.confirm({
      title: '确认发布公告',
      content: `将发送给 ${recipients.value} 人，渠道：${snapshot.channels.map(channelLabel).join('、')}。`,
      okText: '确认发布',
      cancelText: '取消',
      maskClosable: false,
      onCancel: () => {
        confirming.value = false;
      },
      onOk: async () => {
        if (publishing.value || !alive) return;
        publishing.value = true;
        try {
          const result = await createNotificationBroadcastApi(snapshot);
          if (!alive) return;
          message.success(`已发送给 ${result.recipients} 人`);
          form.title = '';
          form.body = '';
          recipients.value = undefined;
          await sent();
        } catch (error_) {
          if (alive) error.value = notificationError(error_);
        } finally {
          if (alive) {
            publishing.value = false;
            confirming.value = false;
          }
        }
      },
    });
  }
  onUnmounted(() => {
    alive = false;
    sequence++;
    userSequence++;
    clearTimeout(timer);
    confirmation?.destroy();
  });
  return {
    form,
    roleIds,
    userIds,
    roles,
    users,
    lookupError,
    loadingRoles,
    loadingUsers,
    error,
    previewing,
    locked,
    recipients,
    searchUsers,
    preview,
    publish,
  };
}
