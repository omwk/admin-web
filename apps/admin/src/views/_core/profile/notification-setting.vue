<script setup lang="ts">
import type { IdentityUser } from '#/api/model/identity';
import type {
  PersonalNotificationChannel,
  PersonalNotificationChannelView,
} from '#/api/model/notification';

import { computed, onMounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import {
  Alert,
  Button,
  Card,
  Form,
  Input,
  message,
  Modal,
  Space,
  Spin,
  Tag,
} from 'ant-design-vue';

import {
  deletePersonalNotificationChannelApi,
  getPersonalNotificationChannelsApi,
  savePersonalNotificationChannelApi,
  testPersonalNotificationChannelApi,
} from '#/api/core/personal-notification-channels';
import { getMyProfileApi } from '#/api/core/self-service';
import { notificationError } from '#/api/notification-safety';

defineProps<{ embedded?: boolean }>();
const options: {
  channel: PersonalNotificationChannel;
  label: string;
  help: string;
}[] = [
  {
    channel: 'webhook',
    label: 'Webhook',
    help: '填写接收通知的完整 HTTPS 地址，服务需接受包含 title、body 的 JSON POST 请求。',
  },
  {
    channel: 'bark',
    label: 'Bark',
    help: '填写 Bark App 中显示的完整 HTTPS 推送地址，包含设备密钥。',
  },
  {
    channel: 'gotify',
    label: 'Gotify',
    help: '填写 Gotify 的完整 HTTPS 消息推送地址，包含应用令牌。',
  },
];
const channels = ref<PersonalNotificationChannelView[]>([]);
const profile = ref<IdentityUser>();
const loading = ref(false);
const loaded = ref(false);
const busy = ref<null | PersonalNotificationChannel>(null);
const error = ref('');
const formError = ref('');
const editing = ref<PersonalNotificationChannel>();
const endpoint = ref('');
const disabled = computed(
  () => loading.value || busy.value !== null || !loaded.value,
);
const selected = computed(() =>
  options.find((item) => item.channel === editing.value),
);
const configured = (channel: PersonalNotificationChannel) =>
  channels.value.find((item) => item.channel === channel);

async function load() {
  if (loading.value || busy.value) return;
  loading.value = true;
  loaded.value = false;
  error.value = '';
  try {
    const [user, result] = await Promise.all([
      getMyProfileApi(),
      getPersonalNotificationChannelsApi(),
    ]);
    profile.value = user;
    channels.value = result.channels;
    loaded.value = true;
  } catch (error_) {
    error.value = notificationError(error_);
  } finally {
    loading.value = false;
  }
}
async function refreshChannels() {
  try {
    const result = await getPersonalNotificationChannelsApi();
    channels.value = result.channels;
    return true;
  } catch (error_) {
    error.value = notificationError(error_);
    loaded.value = false;
    return false;
  }
}
function edit(channel: PersonalNotificationChannel) {
  if (disabled.value) return;
  endpoint.value = '';
  formError.value = '';
  editing.value = channel;
}
function close() {
  if (busy.value) return;
  editing.value = undefined;
  endpoint.value = '';
  formError.value = '';
}
async function verify(channel: PersonalNotificationChannel) {
  let delivery;
  try {
    delivery = await testPersonalNotificationChannelApi(channel);
  } finally {
    await refreshChannels();
  }
  if (delivery.status !== 'sent')
    throw new Error(
      `测试失败：${delivery.last_error_message || (delivery.last_error === 'provider_delivery_failed' ? '目标服务投递失败，请检查推送地址和服务状态' : delivery.last_error) || '通知方式暂不可用，请检查地址后重试'}`,
    );
  if (!loaded.value || !configured(channel)?.verified_at)
    throw new Error('暂未确认验证状态，请刷新后重试');
}
async function save() {
  if (!editing.value || disabled.value) return;
  const channel = editing.value;
  const raw = endpoint.value.trim();
  formError.value = '';
  try {
    const url = new URL(raw);
    if (
      url.protocol !== 'https:' ||
      !url.hostname ||
      url.username ||
      url.password ||
      url.hash ||
      /[\r\n\\]/.test(raw) ||
      new TextEncoder().encode(raw).length > 2048
    )
      throw new Error('Invalid endpoint');
  } catch {
    formError.value =
      '请输入有效的 HTTPS URL（不含登录凭据或片段，最多 2048 字节）';
    return;
  }
  busy.value = channel;
  error.value = '';
  let stored = false;
  try {
    const saved = await savePersonalNotificationChannelApi(channel, raw);
    channels.value = [
      ...channels.value.filter((item) => item.channel !== channel),
      saved,
    ];
    stored = true;
    editing.value = undefined;
    endpoint.value = '';
    await verify(channel);
    message.success('测试成功，通知方式已验证');
  } catch (error_) {
    const reason = notificationError(error_, [raw]);
    if (stored) error.value = reason;
    else formError.value = reason;
  } finally {
    busy.value = null;
  }
}
async function test(channel: PersonalNotificationChannel) {
  if (disabled.value) return;
  busy.value = channel;
  error.value = '';
  try {
    await verify(channel);
    message.success('测试成功，通知方式已验证');
  } catch (error_) {
    error.value = notificationError(error_);
  } finally {
    busy.value = null;
  }
}
function remove(channel: PersonalNotificationChannel, label: string) {
  if (disabled.value) return;
  Modal.confirm({
    title: `删除 ${label} 通知方式？`,
    content: '删除后，该通知方式在个人通知偏好中将变为未配置。',
    okText: '删除',
    cancelText: '取消',
    okType: 'danger',
    async onOk() {
      if (disabled.value) return;
      busy.value = channel;
      error.value = '';
      try {
        await deletePersonalNotificationChannelApi(channel);
        channels.value = channels.value.filter(
          (item) => item.channel !== channel,
        );
        await refreshChannels();
        message.success('通知方式已删除');
      } catch (error_) {
        error.value = notificationError(error_);
      } finally {
        busy.value = null;
      }
    },
  });
}
onMounted(load);
</script>

<template>
  <div data-testid="personal-notifications">
    <Space class="mb-4" wrap>
      <RouterLink v-if="!embedded" to="/profile">
        <Button>基本资料</Button>
      </RouterLink>
      <RouterLink to="/system/notifications/preferences">
        <Button>通知偏好</Button>
      </RouterLink>
      <Button :disabled="loading || !!busy" @click="load">刷新</Button>
    </Space>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Spin :spinning="loading">
      <Card title="账号渠道 · 邮件" class="mb-4" data-testid="personal-email">
        <p class="mb-2 break-all">
          {{
            profile?.email || (loaded ? '尚未填写账号邮箱' : '等待加载账号邮箱')
          }}
        </p>
        <Tag :color="profile?.email ? 'green' : 'default'">
          {{ profile?.email ? '已启用' : '未配置' }}
        </Tag>
        <p class="mt-3 text-gray-500">
          通知邮件使用账号邮箱，仅可在基本资料中修改。
        </p>
        <RouterLink to="/profile" class="text-primary">
          前往基本资料
        </RouterLink>
      </Card>
      <div class="grid gap-4 lg:grid-cols-3">
        <Card
          v-for="option in options"
          :key="option.channel"
          :title="option.label"
          :data-channel="option.channel"
        >
          <template v-if="configured(option.channel)">
            <p class="mb-3 break-all" data-testid="channel-endpoint">
              {{ configured(option.channel)?.endpoint_masked }}
            </p>
            <Tag
              :color="
                configured(option.channel)?.verified_at ? 'green' : 'orange'
              "
            >
              {{
                configured(option.channel)?.verified_at ? '已验证' : '未验证'
              }}
            </Tag>
            <Tag v-if="!configured(option.channel)?.enabled">已停用</Tag>
            <Space class="mt-4 flex" wrap>
              <Button
                :disabled="disabled"
                :loading="busy === option.channel"
                @click="test(option.channel)"
              >
                测试
              </Button>
              <Button :disabled="disabled" @click="edit(option.channel)">
                修改配置
              </Button>
              <Button
                danger
                :disabled="disabled"
                @click="remove(option.channel, option.label)"
              >
                删除
              </Button>
            </Space>
          </template>
          <template v-else>
            <Tag>未配置</Tag>
            <div class="mt-4">
              <Button
                type="primary"
                :disabled="disabled"
                @click="edit(option.channel)"
              >
                配置
              </Button>
            </div>
          </template>
        </Card>
      </div>
    </Spin>
    <Alert
      type="info"
      message="企业微信、钉钉机器人由管理员配置，系统公告专用，不发送个人通知。"
      show-icon
      class="mt-4"
    />
    <Modal
      :open="!!editing"
      :title="`配置 ${selected?.label || ''}`"
      ok-text="保存并测试"
      cancel-text="取消"
      :confirm-loading="!!busy"
      :closable="!busy"
      :keyboard="!busy"
      :mask-closable="false"
      :cancel-button-props="{ disabled: !!busy }"
      @ok="save"
      @cancel="close"
    >
      <Alert
        v-if="formError"
        :message="formError"
        type="error"
        show-icon
        class="mb-4"
      />
      <Form layout="vertical" @finish="save">
        <Form.Item label="推送 URL" :help="selected?.help">
          <Input
            v-model:value="endpoint"
            aria-label="推送 URL"
            type="url"
            autocomplete="off"
            :maxlength="2048"
            :disabled="!!busy"
            @press-enter.prevent="save"
          />
        </Form.Item>
        <p class="mt-4 text-gray-500">
          保存会重置验证状态，并立即发送一条测试通知；测试成功后才能用于个人通知。地址保存后仅展示掩码。
        </p>
      </Form>
    </Modal>
  </div>
</template>
