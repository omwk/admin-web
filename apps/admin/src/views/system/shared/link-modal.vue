<script setup lang="ts">
import { ref } from 'vue';

import { Alert, Button, Input, message, Modal } from 'ant-design-vue';

defineProps<{
  description: string;
  link: string;
  open: boolean;
  title: string;
}>();
const emit = defineEmits<{ close: [] }>();
const copying = ref(false);
async function copy(link: string) {
  copying.value = true;
  try {
    await navigator.clipboard.writeText(link);
    message.success('链接已复制');
  } catch {
    message.warning('复制失败，请选中链接手动复制');
  } finally {
    copying.value = false;
  }
}
</script>

<template>
  <Modal
    :open="open"
    :title="title"
    :footer="null"
    destroy-on-close
    @cancel="emit('close')"
  >
    <Alert :message="description" type="info" show-icon class="mb-4" />
    <Input.TextArea
      :value="link"
      aria-label="账号链接"
      :rows="4"
      readonly
      @focus="($event.target as HTMLTextAreaElement).select()"
    />
    <Button type="primary" class="mt-4" :loading="copying" @click="copy(link)">
      复制链接
    </Button>
  </Modal>
</template>
