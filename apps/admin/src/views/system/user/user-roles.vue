<script setup lang="ts">
import type { AdminUser } from '#/api/model/admin-user';
import type { AdminRole } from '#/api/model/system';

import { onMounted, ref } from 'vue';

import { Alert, Button, Checkbox, Modal, Spin } from 'ant-design-vue';

import { getUserRolesApi, setUserRolesApi } from '#/api/core/admin-users';
import { toApiError } from '#/api/errors';

const props = defineProps<{ roles: AdminRole[]; user: AdminUser }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const ids = ref<number[]>([]);
const loading = ref(true);
const loaded = ref(false);
const busy = ref(false);
const error = ref('');
async function load() {
  loading.value = true;
  error.value = '';
  try {
    ids.value = await getUserRolesApi(props.user.id);
    loaded.value = true;
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    loading.value = false;
  }
}
async function save() {
  busy.value = true;
  error.value = '';
  try {
    await setUserRolesApi(props.user.id, ids.value);
    emit('saved');
  } catch (error_) {
    error.value = toApiError(error_).message;
  } finally {
    busy.value = false;
  }
}
onMounted(load);
</script>

<template>
  <Modal
    open
    :title="`分配角色 · ${user.username}`"
    :confirm-loading="busy"
    :ok-button-props="{ disabled: loading || !loaded }"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <Alert v-if="error" type="error" show-icon :message="error" class="mb-4">
      <template v-if="!loaded" #action>
        <Button size="small" @click="load">重试</Button>
      </template>
    </Alert>
    <Spin :spinning="loading">
      <Checkbox.Group
        v-model:value="ids"
        :disabled="busy || loading"
        class="flex flex-col gap-3"
        :options="
          roles.map((role) => ({
            label: `${role.name} (${role.code})`,
            value: role.id,
            disabled: role.status === 'disabled' && !ids.includes(role.id),
          }))
        "
      />
    </Spin>
  </Modal>
</template>
