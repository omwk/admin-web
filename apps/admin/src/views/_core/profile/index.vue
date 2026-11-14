<script setup lang="ts">
import type { IdentityUser } from '#/api/model/identity';

import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink } from 'vue-router';

import { Page } from '@vben/common-ui';
import { useUserStore } from '@vben/stores';

import { Alert, Button, Card, Spin } from 'ant-design-vue';

import { getMyProfileApi } from '#/api/core/self-service';
import { toUserInfo } from '#/api/core/user';
import { toApiError } from '#/api/errors';

import BaseSetting from './base-setting.vue';
import PasswordSetting from './password-setting.vue';

defineOptions({ name: 'PersonalProfile' });
const profile = ref<IdentityUser>();
const loading = ref(false);
const error = ref('');
const revision = ref(0);
const userStore = useUserStore();
let sequence = 0;
async function load() {
  const current = ++sequence;
  loading.value = true;
  error.value = '';
  try {
    const user = await getMyProfileApi();
    if (current !== sequence) return;
    profile.value = user;
    revision.value++;
    userStore.setUserInfo(toUserInfo(user));
  } catch (error_) {
    if (current === sequence) error.value = toApiError(error_).message;
  } finally {
    if (current === sequence) loading.value = false;
  }
}
onMounted(load);
onUnmounted(() => {
  sequence++;
});
</script>

<template>
  <Page title="个人资料" description="管理基本信息、登录密码和设备会话。">
    <RouterLink to="/profile/sessions">
      <Button class="mb-4">我的会话</Button>
    </RouterLink>
    <Alert v-if="error" :message="error" type="error" show-icon class="mb-4">
      <template #action>
        <Button size="small" @click="load">重试</Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <div class="grid gap-4 xl:grid-cols-2">
        <Card title="基本信息">
          <BaseSetting
            v-if="profile"
            :key="revision"
            :profile="profile"
            @saved="load"
          />
        </Card>
        <Card title="修改密码"><PasswordSetting /></Card>
      </div>
    </Spin>
  </Page>
</template>
