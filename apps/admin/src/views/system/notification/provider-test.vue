<script setup lang="ts">
import type {
  NotificationDelivery,
  NotificationProvider,
} from '#/api/model/notification';

import { onUnmounted, ref } from 'vue';

import { Alert, Button, message, Modal, Space } from 'ant-design-vue';

import {
  getNotificationDeliveriesApi,
  testNotificationProviderApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

const props = defineProps<{ provider: NotificationProvider }>();
const emit = defineEmits<{ close: []; updated: [] }>();
const sending = ref(false);
const refreshing = ref(false);
const error = ref('');
const delivery = ref<NotificationDelivery>();
let timer: ReturnType<typeof setTimeout> | undefined;
let disposed = false;
let polls = 0;
function accept(value: NotificationDelivery) {
  const previous = delivery.value?.status;
  delivery.value = value;
  if (value.status !== previous) emit('updated');
  if (value.status === 'sent' && previous !== 'sent')
    message.success('已发送，请查收');
  if (value.status === 'pending' && polls++ < 20 && !disposed)
    timer = setTimeout(() => {
      void refresh();
    }, 1500);
}
async function refresh() {
  if (!delivery.value || refreshing.value || disposed) return;
  clearTimeout(timer);
  refreshing.value = true;
  error.value = '';
  try {
    const result = await getNotificationDeliveriesApi(1, 100);
    const latest = result.list.find((value) => value.id === delivery.value?.id);
    if (!disposed && latest) accept(latest);
  } catch (error_) {
    if (!disposed) error.value = notificationError(error_);
  } finally {
    refreshing.value = false;
  }
}
async function send() {
  if (sending.value || delivery.value?.status === 'pending') return;
  sending.value = true;
  error.value = '';
  try {
    const result = await testNotificationProviderApi(props.provider.id);
    if (!disposed) {
      polls = 0;
      accept(result);
    }
  } catch (error_) {
    if (!disposed) error.value = notificationError(error_);
  } finally {
    sending.value = false;
  }
}
onUnmounted(() => {
  disposed = true;
  clearTimeout(timer);
});
</script>

<template>
  <Modal
    open
    title="测试发送"
    :footer="null"
    :mask-closable="false"
    @cancel="emit('close')"
  >
    <div data-testid="notification-provider-test">
      <Alert
        type="info"
        message="测试将发送给当前登录账号，收件地址由后端读取；每租户每分钟最多测试三次。"
        show-icon
        class="mb-4"
      />
      <p class="mb-4">服务商：{{ provider.name }}</p>
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <template v-if="delivery">
        <Alert
          v-if="delivery.status === 'sent'"
          message="已发送，请查收"
          type="success"
          show-icon
          class="mb-4"
        />
        <Alert
          v-else-if="delivery.status === 'pending'"
          message="测试已提交，投递处理中"
          description="此时尚未确认发送成功，可刷新状态或在投递记录中查看。"
          type="info"
          show-icon
          class="mb-4"
        />
        <Alert
          v-else
          message="测试发送失败"
          :description="`失败原因：${delivery.last_error || delivery.status}`"
          type="error"
          show-icon
          class="mb-4"
        />
        <p class="mb-4">
          投递编号：{{ delivery.id }}；尝试次数：{{ delivery.attempts }}
        </p>
      </template>
      <Space>
        <Button
          type="primary"
          :loading="sending"
          :disabled="delivery?.status === 'pending'"
          @click="send"
        >
          发送给当前账号
        </Button>
        <Button v-if="delivery" :loading="refreshing" @click="refresh">
          刷新状态
        </Button>
        <Button :disabled="sending" @click="emit('close')">关闭</Button>
      </Space>
    </div>
  </Modal>
</template>
