<script setup lang="ts">
import type { LibraryFile } from '#/api/model/storage';

import { onUnmounted, reactive, ref } from 'vue';

import { Alert, Button, message, Progress } from 'ant-design-vue';

import { uploadFileApi } from '#/api/core/files';

import {
  fileAccept,
  fileHint,
  normalizeUploadFile,
  uploadError,
  validateFile,
} from './options';

const props = defineProps<{ canConfigure: boolean }>();
const emit = defineEmits<{ uploaded: [file: LibraryFile] }>();
const picker = ref<HTMLInputElement>();
const busy = ref(false);
const dragging = ref(false);
const jobs = ref<
  {
    error: string;
    id: string;
    name: string;
    percent: number;
    status: 'active' | 'exception' | 'success';
  }[]
>([]);
let controller: AbortController | undefined;
let disposed = false;
onUnmounted(() => {
  disposed = true;
  controller?.abort();
});
function choose() {
  if (!busy.value) picker.value?.click();
}
async function upload(files: File[]) {
  if (busy.value || disposed) return;
  busy.value = true;
  jobs.value = [];
  try {
    for (const original of files) {
      if (disposed) break;
      const file = normalizeUploadFile(original);
      const state = reactive({
        id: crypto.randomUUID(),
        name: file.name,
        percent: 0,
        error: validateFile(file),
        status: 'active' as 'active' | 'exception' | 'success',
      });
      jobs.value.push(state);
      if (state.error) {
        state.status = 'exception';
        continue;
      }
      controller = new AbortController();
      try {
        const saved = await uploadFileApi(
          file,
          (percent) => {
            state.percent = percent;
          },
          controller.signal,
        );
        if (disposed) break;
        state.percent = 100;
        state.status = 'success';
        message.success(`「${saved.original_name}」上传成功`);
        emit('uploaded', saved);
      } catch (error) {
        if (disposed) break;
        state.error = uploadError(error);
        state.status = 'exception';
      }
    }
  } finally {
    busy.value = false;
    controller = undefined;
    if (picker.value) picker.value.value = '';
  }
}
function change(event: Event) {
  void upload([...((event.target as HTMLInputElement).files ?? [])]);
}
function drop(event: DragEvent) {
  dragging.value = false;
  void upload([...(event.dataTransfer?.files ?? [])]);
}
</script>

<template>
  <section aria-label="文件上传" class="mb-5">
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <Button type="primary" :loading="busy" @click="choose">上传文件</Button>
      <span class="text-sm text-muted-foreground">
        拖拽或点击，单个文件 ≤20 MB
      </span>
    </div>
    <input
      ref="picker"
      type="file"
      aria-label="选择上传文件"
      :accept="fileAccept"
      :disabled="busy"
      class="sr-only"
      multiple
      @change="change"
    />
    <div
      role="button"
      tabindex="0"
      aria-label="点击或拖拽上传文件"
      :aria-disabled="busy"
      class="cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors"
      :class="
        dragging ? 'border-primary bg-accent' : 'border-border bg-background'
      "
      @click="choose"
      @keydown.enter.prevent="choose"
      @keydown.space.prevent="choose"
      @dragover.prevent="dragging = true"
      @dragleave.prevent="dragging = false"
      @drop.prevent="drop"
    >
      <p class="mb-2 font-medium">
        {{ busy ? '文件上传中，请稍候…' : '点击或拖拽文件到这里上传' }}
      </p>
      <p class="text-xs text-muted-foreground">{{ fileHint }}</p>
    </div>
    <div
      v-for="job in jobs"
      :key="job.id"
      class="mt-3"
      :data-upload-status="job.status"
    >
      <div class="truncate text-sm" :title="job.name">{{ job.name }}</div>
      <Progress :percent="job.percent" :status="job.status" />
      <Alert v-if="job.error" :message="job.error" type="error" show-icon />
      <p
        v-if="job.error.includes('存储')"
        class="mt-2 text-sm text-muted-foreground"
      >
        请{{
          props.canConfigure
            ? '先配置并启用默认对象存储'
            : '联系平台管理员配置对象存储'
        }}。
        <RouterLink
          v-if="props.canConfigure"
          to="/system/storage"
          class="text-primary"
        >
          前往存储配置
        </RouterLink>
      </p>
    </div>
  </section>
</template>
