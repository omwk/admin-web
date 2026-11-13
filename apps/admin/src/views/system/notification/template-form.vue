<script setup lang="ts">
import type { NotificationTemplate } from '#/api/model/notification';

import { reactive, ref } from 'vue';

import { Alert, Form, Input, Modal, Switch, Tag } from 'ant-design-vue';

import { saveNotificationTemplateApi } from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

const props = defineProps<{ template: NotificationTemplate }>();
const emit = defineEmits<{ close: []; saved: [] }>();
const form = reactive({
  subject: props.template.subject,
  body: props.template.body,
  locale: props.template.locale,
  format: props.template.format,
  enabled: props.template.enabled,
});
const busy = ref(false);
const error = ref('');
const variables = ['{{.Name}}', '{{.Platform}}', '{{.Severity}}', '{{.Path}}'];
async function save() {
  if (busy.value) return;
  if (!form.subject.trim() || !form.body.trim()) {
    error.value = '请填写主题和正文';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    await saveNotificationTemplateApi(props.template.code, { ...form });
    emit('saved');
  } catch (error_) {
    error.value = notificationError(error_);
  } finally {
    busy.value = false;
  }
}
</script>

<template>
  <Modal
    open
    title="编辑通知模板"
    :width="720"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <div data-testid="notification-template-form">
      <Alert
        v-if="error"
        :message="error"
        type="error"
        show-icon
        class="mb-4"
      />
      <p class="mb-3">
        {{ template.code }} · {{ template.locale }} · {{ template.format }}
      </p>
      <p class="mb-3 text-gray-500">
        可用变量：<Tag v-for="variable in variables" :key="variable">
          {{ variable }}
        </Tag>
      </p>
      <Form layout="vertical" :disabled="busy">
        <Form.Item label="主题" required>
          <Input
            v-model:value="form.subject"
            aria-label="模板主题"
            :maxlength="500"
          />
        </Form.Item>
        <Form.Item label="正文" required>
          <Input.TextArea
            v-model:value="form.body"
            aria-label="模板正文"
            :rows="9"
            :maxlength="131072"
          />
        </Form.Item>
        <Form.Item label="启用">
          <Switch v-model:checked="form.enabled" aria-label="启用模板" />
        </Form.Item>
      </Form>
      <p class="text-xs text-gray-500">
        保存为租户模板覆盖；正文按源文本编辑，格式沿用原模板。
      </p>
    </div>
  </Modal>
</template>
