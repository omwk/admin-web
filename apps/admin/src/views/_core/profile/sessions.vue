<script setup lang="ts">
import type { IdentitySession } from '#/api/model/identity';

import { computed, onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { Page } from '@vben/common-ui';

import {
  Alert,
  Button,
  Card,
  message,
  Modal,
  Space,
  Table,
  Tag,
  Tooltip,
} from 'ant-design-vue';

import {
  getMySessionsApi,
  logoutOthersApi,
  revokeMySessionApi,
} from '#/api/core/self-service';
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
const confirming = ref<'all' | 'others' | 'single'>();
const selected = ref<IdentitySession>();
const error = ref('');
const otherCount = computed(() => Math.max(total.value - 1, 0));
const confirmationTitle = computed(() => {
  if (confirming.value === 'all') return '确认全部下线';
  if (confirming.value === 'others') return '确认下线其他设备';
  return '确认下线会话';
});
let sequence = 0;
const columns = [
  { dataIndex: 'created_at', title: '登录时间', width: 190 },
  { dataIndex: 'ip', title: 'IP', width: 170 },
  { dataIndex: 'user_agent', title: 'User-Agent', width: 400 },
  { dataIndex: 'status', title: '状态', width: 110 },
  { dataIndex: 'action', title: '操作', width: 130 },
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
function confirmSingle(session: IdentitySession) {
  if (
    loading.value ||
    acting.value ||
    session.current !== false ||
    !session.sid
  )
    return;
  selected.value = session;
  confirming.value = 'single';
}
async function revoke() {
  const mode = confirming.value;
  const target = selected.value;
  if (acting.value || loading.value || !mode) return;
  if (mode === 'others' && total.value <= 1) return;
  if (mode === 'single' && (!target?.sid || target.current !== false)) return;
  acting.value = true;
  error.value = '';
  try {
    if (mode === 'all') {
      await auth.logoutAll();
      return;
    }
    let nextPage = page.value;
    if (mode === 'others') {
      const { revoked } = await logoutOthersApi();
      message.success(`已下线 ${revoked} 个会话`);
      nextPage = 1;
    } else if (target) {
      await revokeMySessionApi(target.sid);
      message.success('已下线该会话');
      if (sessions.value.length === 1) nextPage = Math.max(page.value - 1, 1);
    }
    confirming.value = undefined;
    selected.value = undefined;
    await load(nextPage);
  } catch (error_) {
    error.value = toApiError(error_).message;
    confirming.value = undefined;
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
  <Page title="我的会话" description="查看登录设备，管理各设备的登录会话。">
    <RouterLink to="/profile">
      <Button class="mb-4">返回个人资料</Button>
    </RouterLink>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Card title="登录会话">
      <template #extra>
        <Space>
          <Button :disabled="loading || acting" @click="load()">刷新</Button>
          <Button
            :disabled="loading || acting || total <= 1"
            @click="confirming = 'others'"
          >
            下线其他设备
          </Button>
          <Button
            danger
            :disabled="loading || acting"
            @click="confirming = 'all'"
          >
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
          disabled: loading || acting,
          showSizeChanger: false,
          onChange: load,
        }"
        :scroll="{ x: 1000 }"
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
          <template v-else-if="column.dataIndex === 'action'">
            <Tag
              v-if="status(record as IdentitySession) === '当前'"
              color="success"
            >
              当前设备
            </Tag>
            <Button
              v-else-if="record.current === false && record.sid"
              danger
              type="link"
              :disabled="loading || acting"
              @click="confirmSingle(record as IdentitySession)"
            >
              下线
            </Button>
            <span v-else class="text-muted-foreground">未提供</span>
          </template>
        </template>
      </Table>
    </Card>
    <Modal
      :open="!!confirming"
      :title="confirmationTitle"
      :closable="!acting"
      :mask-closable="!acting"
      :keyboard="!acting"
      :footer="null"
      @cancel="confirming = undefined"
    >
      <p v-if="confirming === 'all'" class="mb-4">
        所有设备的登录将失效，当前设备也将退出登录。你需要重新输入账号和密码。
      </p>
      <p v-else-if="confirming === 'others'" class="mb-4">
        将下线除当前设备外的 {{ otherCount }} 个会话，确定？
      </p>
      <p v-else class="mb-4">将下线该会话，当前设备将保持登录，确定？</p>
      <Space>
        <Button
          danger
          type="primary"
          :loading="acting"
          :disabled="loading"
          @click="revoke"
        >
          {{ confirmationTitle }}
        </Button>
        <Button :disabled="acting" @click="confirming = undefined">取消</Button>
      </Space>
    </Modal>
  </Page>
</template>
