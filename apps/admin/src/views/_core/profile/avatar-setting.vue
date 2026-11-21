<script setup lang="ts">
import type { IdentityUser } from '#/api/model/identity';

import { computed, onUnmounted, ref } from 'vue';

import { Avatar, Button, message } from 'ant-design-vue';

import { updateMyProfileApi, uploadMyAvatarApi } from '#/api/core/self-service';
import { toApiError } from '#/api/errors';
import { avatarUrl } from '#/utils/avatar';

const props = defineProps<{ disabled: boolean; profile: IdentityUser }>();
const emit = defineEmits<{ busy: [value: boolean]; saved: [avatar: string] }>();
const picker = ref<HTMLInputElement>();
const busy = ref(false);
const error = ref('');
const version = ref<number | string>(Date.now());
const preview = computed(() => avatarUrl(props.profile, version.value));
let controller: AbortController | undefined;
let disposed = false;
onUnmounted(() => {
  disposed = true;
  controller?.abort();
});
function setBusy(value: boolean) {
  busy.value = value;
  emit('busy', value);
}
async function change(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  input.value = '';
  if (!file || busy.value || props.disabled) return;
  error.value = '';
  if (file.size > 2 * 1024 * 1024) {
    error.value = '头像超过 2 MB 上限';
    return;
  }
  if (
    !['image/gif', 'image/jpeg', 'image/png'].includes(file.type.toLowerCase())
  ) {
    error.value = '头像仅支持 JPG、PNG、GIF 图片';
    return;
  }
  setBusy(true);
  controller = new AbortController();
  try {
    const saved = await uploadMyAvatarApi(file, controller.signal);
    if (disposed) return;
    version.value = saved.file_id;
    emit('saved', saved.avatar);
    message.success('头像已更新');
  } catch (error_) {
    if (!disposed) showError(error_);
  } finally {
    if (!disposed) setBusy(false);
    controller = undefined;
  }
}
function showError(failure: unknown) {
  const value = toApiError(failure);
  error.value = [400, 409, 413].includes(value.status ?? 0)
    ? value.businessMessage || value.message
    : value.message;
}
async function remove() {
  if (busy.value || props.disabled) return;
  error.value = '';
  setBusy(true);
  try {
    await updateMyProfileApi({
      nickname: props.profile.nickname || '',
      avatar: '',
    });
    if (disposed) return;
    emit('saved', '');
    message.success('头像已删除');
  } catch (error_) {
    if (!disposed) showError(error_);
  } finally {
    if (!disposed) setBusy(false);
  }
}
</script>

<template>
  <div class="flex flex-wrap items-center gap-3">
    <Avatar
      :src="preview || undefined"
      :size="64"
      shape="circle"
      alt="头像预览"
      class="shrink-0"
    >
      {{ profile.nickname?.slice(0, 1) || profile.username.slice(0, 1) }}
    </Avatar>
    <Button
      :loading="busy"
      :disabled="disabled || busy"
      @click="picker?.click()"
    >
      上传新头像
    </Button>
    <Button
      danger
      :disabled="disabled || busy || !profile.avatar"
      @click="remove"
    >
      删除
    </Button>
    <input
      ref="picker"
      type="file"
      aria-label="选择新头像"
      accept="image/jpeg,image/png,image/gif"
      class="sr-only"
      :disabled="disabled || busy"
      @change="change"
    />
  </div>
  <p class="mt-2 text-sm text-muted-foreground">支持 JPG/PNG/GIF，≤2 MB</p>
  <p v-if="error" role="alert" class="mt-2 text-sm text-destructive">
    {{ error }}
  </p>
</template>
