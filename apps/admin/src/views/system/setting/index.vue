<script setup lang="ts">
import type { SettingGroup } from '#/api/model/configuration';

import { computed, onMounted, onUnmounted, ref } from 'vue';

import { Page } from '@vben/common-ui';

import { Alert, Button, Card, Empty, Spin, Tabs } from 'ant-design-vue';

import { getSettingsApi } from '#/api/core/settings';
import { toApiError } from '#/api/errors';
import { hasPermission } from '#/auth/permission';

import GroupForm from './group-form.vue';

defineOptions({ name: 'SystemSettings' });
const order = ['security', 'system', 'notification', 'sync', 'tenant'];
const labels: Record<string, string> = {
  tenant: '注册',
  security: '安全配置',
  system: '系统配置',
  notification: '通知配置',
  sync: '同步配置',
};
const groups = ref<SettingGroup[]>([]);
const sorted = computed(() =>
  groups.value.toSorted(
    (a, b) => order.indexOf(a.group) - order.indexOf(b.group),
  ),
);
const active = ref('security');
const loading = ref(false);
const saving = ref(false);
const error = ref('');
let sequence = 0;
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const result = await getSettingsApi();
    if (current !== sequence) return;
    groups.value = result;
    if (!result.some((group) => group.group === active.value))
      active.value = result[0]?.group ?? '';
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
function saved(group: SettingGroup) {
  groups.value = groups.value.map((current) =>
    current.group === group.group ? group : current,
  );
}
onMounted(load);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page
    title="系统配置"
    description="按分组管理配置，查看每项的取值范围和生效说明。"
  >
    <Alert
      message="部分配置对新会话生效"
      description="修改不会重写已签发的会话。标注为后续请求读取的配置会在后续请求中使用；其他配置当前仅保存与展示。"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert
      v-if="
        !hasPermission('system:setting:update') &&
        (active !== 'tenant' || !hasPermission('system:tenant:manage'))
      "
      message="当前仅有查看权限"
      type="info"
      show-icon
      class="mb-4"
    />
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4" />
    <Card title="配置分组">
      <template #extra>
        <Button :disabled="saving || loading" @click="load"> 刷新配置 </Button>
      </template>
      <Spin :spinning="loading">
        <Tabs
          v-if="groups.length"
          v-model:active-key="active"
          :destroy-inactive-tab-pane="false"
        >
          <Tabs.TabPane
            v-for="group in sorted"
            :key="group.group"
            :tab="`${labels[group.group] ?? group.group} ${group.group}（${group.items.length}）`"
            :disabled="saving"
          >
            <GroupForm :group="group" @busy="saving = $event" @saved="saved" />
          </Tabs.TabPane>
        </Tabs>
        <Empty v-else-if="!loading" description="暂无配置" />
      </Spin>
    </Card>
  </Page>
</template>
