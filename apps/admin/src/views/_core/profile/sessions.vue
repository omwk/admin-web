<script setup lang="ts">
import type { IdentitySession } from '#/api/model/identity';

import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import { getMySessionsApi } from '#/api/core/self-service';
import { toApiError } from '#/api/errors';
import { getCurrentSessionId } from '#/auth/token';
import { useAuthStore } from '#/store/auth';
import { formatDateTime } from '#/utils/datetime';

defineOptions({ name: 'MySessions' });
const auth = useAuthStore();
const sessions = ref<IdentitySession[]>([]);
const page = ref(1);
const total = ref(0);
const loading = ref(false);
const acting = ref(false);
const confirming = ref(false);
const error = ref('');
let sequence = 0;
const columns = [
  { dataIndex: 'created_at', title: '登录时间', width: 190 },
  { dataIndex: 'ip', title: 'IP', width: 170 },
  { dataIndex: 'user_agent', title: 'User-Agent', width: 400 },
  { dataIndex: 'status', title: '状态', width: 110 },
];
function status(session: IdentitySession) {
  if (session.current !== undefined) return session.current ? '当前' : '其他';
  const current = getCurrentSessionId();
  if (!session.sid || !current) return '未提供';
  return current === session.sid ? '当前' : '其他';
}
async function load(nextPage = page.value) {
  const current = ++sequence;
  page.value = nextPage;
  loading.value = true;
  error.value = '';
  try {
    const data = await getMySessionsApi(page.value, 20);
    if (current !== sequence) return;
    sessions.value = data.list ?? [];
    total.value = data.total;
  } catch (error_) {
    if (current !== sequence) return;
    sessions.value = [];
    total.value = 0;
    error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
async function logoutAll() {
  if (acting.value) return;
  acting.value = true;
  error.value = '';
  try {
    await auth.logoutAll();
  } catch (error_) {
    error.value = toApiError(error_).message;
    confirming.value = false;
  } finally {
    acting.value = false;
  }
}
onMounted(() => load());
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page title="我的会话" description="查看登录设备，结束所有设备的登录。">
    <RouterLink to="/profile">
      <Button class="mb-4">返回个人资料</Button>
    </RouterLink>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Card title="登录会话">
      <template #extra>
        <Space>
          <Button :disabled="loading || acting" @click="load()">刷新</Button>
          <Button danger :disabled="acting" @click="confirming = true">
            全部下线
          </Button>
        </Space>
      </template>
      <Table
        data-testid="my-sessions"
        :columns="columns"
        :data-source="sessions"
        :loading="loading"
        :row-key="(record: IdentitySession) => record.sid || record.created_at"
        :pagination="{
          current: page,
          pageSize: 20,
          total,
          showSizeChanger: false,
          onChange: load,
        }"
        :scroll="{ x: 870 }"
        :locale="{ emptyText: '暂无登录会话' }"
      >
        <template #bodyCell="{ column, record, text }">
          <template v-if="column.dataIndex === 'created_at'">
            {{ formatDateTime(text) }}
          </template>
          <template v-else-if="column.dataIndex === 'ip'">
            {{ text || '未提供' }}
          </template>
          <Tooltip
            v-else-if="column.dataIndex === 'user_agent'"
            :title="text || '未提供'"
          >
            <span class="block max-w-sm truncate">{{ text || '未提供' }}</span>
          </Tooltip>
          <Tag
            v-else-if="column.dataIndex === 'status'"
            :color="
              status(record as IdentitySession) === '当前'
                ? 'success'
                : 'default'
            "
          >
            {{ status(record as IdentitySession) }}
          </Tag>
        </template>
      </Table>
    </Card>
    <Modal
      :open="confirming"
      title="确认全部下线"
      :closable="!acting"
      :mask-closable="!acting"
      :keyboard="!acting"
      :footer="null"
      @cancel="confirming = false"
    >
      <p class="mb-4">
        所有设备的登录将失效，当前设备也将退出登录。你需要重新输入账号和密码。
      </p>
      <Space>
        <Button danger type="primary" :loading="acting" @click="logoutAll">
          确认全部下线
        </Button>
        <Button :disabled="acting" @click="confirming = false">取消</Button>
      </Space>
    </Modal>
  </Page>
</template>
