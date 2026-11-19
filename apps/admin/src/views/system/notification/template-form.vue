<script setup lang="ts">
import type {
  NotificationTemplate,
  NotificationTemplatePreview,
  NotificationVariable,
} from '#/api/model/notification';

import { computed, nextTick, onMounted, onUnmounted, reactive, ref } from 'vue';

import {
  Alert,
  Button,
  Drawer,
  Empty,
  Form,
  Input,
  message,
  Modal,
  Spin,
  Switch,
  Tag,
} from 'ant-design-vue';

import {
  getNotificationTemplateVariablesApi,
  previewNotificationTemplateApi,
  saveNotificationTemplateApi,
  testNotificationTemplateApi,
} from '#/api/core/notifications';
import { notificationError } from '#/api/notification-safety';

import {
  insertVariable,
  referencedVariables,
  unknownVariables,
} from './template-variables';

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
const loading = ref(true);
const catalogLoaded = ref(false);
const error = ref('');
const catalogError = ref('');
const variables = ref<NotificationVariable[]>([]);
const preview = ref<NotificationTemplatePreview>();
const root = ref<HTMLElement>();
let alive = true;
let selection = {
  field: 'body' as 'body' | 'subject',
  start: form.body.length,
  end: form.body.length,
};
const dirty = computed(
  () =>
    form.subject !== props.template.subject ||
    form.body !== props.template.body ||
    form.enabled !== props.template.enabled,
);
const missing = computed(() => {
  const used = referencedVariables(`${form.subject}\n${form.body}`);
  return variables.value.filter(
    (item) => item.required && !used.includes(item.name),
  );
});
const htmlPreview = computed(
  () =>
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:">${preview.value?.body ?? ''}`,
);
async function loadVariables() {
  loading.value = true;
  catalogLoaded.value = false;
  catalogError.value = '';
  try {
    const catalog = await getNotificationTemplateVariablesApi();
    if (!alive) return;
    const declared = catalog[props.template.code];
    if (!declared) throw new Error('当前模板未声明可用变量，请联系管理员');
    variables.value = declared;
    catalogLoaded.value = true;
  } catch (error_) {
    if (alive) catalogError.value = notificationError(error_);
  } finally {
    if (alive) loading.value = false;
  }
}
function remember(event: Event, field: 'body' | 'subject') {
  const input = event.target as HTMLInputElement | HTMLTextAreaElement;
  selection = {
    field,
    start: input.selectionStart ?? 0,
    end: input.selectionEnd ?? 0,
  };
}
async function insert(name: string) {
  const { field, start, end } = selection;
  const result = insertVariable(form[field], name, start, end);
  form[field] = result.text;
  selection = { field, start: result.caret, end: result.caret };
  await nextTick();
  const input = root.value?.querySelector<
    HTMLInputElement | HTMLTextAreaElement
  >(`[data-template-field="${field}"]`);
  input?.focus();
  input?.setSelectionRange(result.caret, result.caret);
}
async function save() {
  if (busy.value) return;
  error.value = '';
  if (!catalogLoaded.value) {
    error.value = '变量列表尚未加载，无法校验，请重试';
    return;
  }
  if (!form.subject.trim() || !form.body.trim()) {
    error.value = '请填写主题和正文';
    return;
  }
  const unknown = unknownVariables(
    `${form.subject}\n${form.body}`,
    variables.value,
  );
  if (unknown.length > 0) {
    error.value = `引用了未声明的变量：${unknown.join('、')}`;
    return;
  }
  busy.value = true;
  try {
    await saveNotificationTemplateApi(props.template.code, { ...form });
    if (alive) emit('saved');
  } catch (error_) {
    if (alive) error.value = notificationError(error_);
  } finally {
    if (alive) busy.value = false;
  }
}
async function tool(kind: 'preview' | 'test') {
  if (busy.value || dirty.value) return;
  busy.value = true;
  error.value = '';
  try {
    if (kind === 'preview') {
      const result = await previewNotificationTemplateApi(props.template.id);
      if (alive) preview.value = result;
    } else {
      await testNotificationTemplateApi(props.template.id);
      if (alive) message.success('已发送测试邮件，可在投递记录查看');
    }
  } catch (error_) {
    if (alive) error.value = notificationError(error_);
  } finally {
    if (alive) busy.value = false;
  }
}
onMounted(loadVariables);
onUnmounted(() => {
  alive = false;
});
</script>

<template>
  <Modal
    open
    title="编辑通知模板"
    ok-text="保存"
    cancel-text="取消"
    :width="1100"
    :confirm-loading="busy"
    :cancel-button-props="{ disabled: busy }"
    :closable="!busy"
    :mask-closable="false"
    @ok="save"
    @cancel="emit('close')"
  >
    <div ref="root" data-testid="notification-template-form">
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
      <div class="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Form layout="vertical" :disabled="busy">
          <Form.Item label="主题" required>
            <Input
              v-model:value="form.subject"
              aria-label="模板主题"
              data-template-field="subject"
              :maxlength="500"
              @focus="remember($event, 'subject')"
              @select="remember($event, 'subject')"
              @keyup="remember($event, 'subject')"
              @click="remember($event, 'subject')"
              @input="remember($event, 'subject')"
            />
          </Form.Item>
          <Form.Item label="正文" required>
            <Input.TextArea
              v-model:value="form.body"
              aria-label="模板正文"
              data-template-field="body"
              :rows="14"
              :maxlength="131072"
              @focus="remember($event, 'body')"
              @select="remember($event, 'body')"
              @keyup="remember($event, 'body')"
              @click="remember($event, 'body')"
              @input="remember($event, 'body')"
            />
          </Form.Item>
          <Form.Item label="启用">
            <Switch v-model:checked="form.enabled" aria-label="启用模板" />
          </Form.Item>
        </Form>
        <aside
          data-testid="template-variables"
          class="min-w-0 rounded border p-3"
        >
          <h3 class="mb-3 font-semibold">当前模板可用变量</h3>
          <Alert
            v-if="catalogError"
            :message="catalogError"
            type="error"
            show-icon
            class="mb-3"
          />
          <Button v-if="catalogError" :loading="loading" @click="loadVariables">
            重试加载变量
          </Button>
          <Spin :spinning="loading">
            <div class="max-h-[500px] overflow-y-auto">
              <div
                v-for="variable in variables"
                :key="variable.name"
                class="mb-3 border-b pb-3"
              >
                <div class="mb-1 flex flex-wrap items-center gap-2">
                  <code v-text="`{{.${variable.name}}}`"></code>
                  <Tag :color="variable.required ? 'orange' : 'default'">
                    {{ variable.required ? '必填' : '选填' }}
                  </Tag>
                  <Button
                    size="small"
                    :aria-label="`插入 ${variable.name}`"
                    :disabled="busy"
                    @mousedown.prevent
                    @click="insert(variable.name)"
                  >
                    插入
                  </Button>
                </div>
                <p>{{ variable.description }}</p>
                <p class="break-all text-xs text-gray-500">
                  示例：{{ variable.example || '（空）' }}
                </p>
              </div>
              <Empty
                v-if="catalogLoaded && !variables.length"
                description="当前模板无需变量"
              />
            </div>
          </Spin>
          <Alert
            v-if="catalogLoaded && missing.length"
            type="warning"
            :message="`必填变量缺失：${missing.map((item) => item.name).join('、')}`"
            show-icon
            class="mt-3"
          />
        </aside>
      </div>
      <p class="mb-3 text-xs text-gray-500">
        预览与测试发送使用已保存版本；有改动时请先保存后重新打开。保存为租户模板覆盖，格式沿用原模板。
      </p>
      <div class="flex gap-3">
        <Button :disabled="busy || dirty" @click="tool('preview')">预览</Button>
        <Button
          :disabled="busy || dirty || !form.enabled"
          @click="tool('test')"
        >
          发送测试
        </Button>
      </div>
    </div>
    <Drawer
      :open="!!preview"
      title="模板预览"
      :width="640"
      @close="preview = undefined"
    >
      <div v-if="preview" data-testid="template-preview">
        <Alert message="用示例值渲染" type="info" show-icon class="mb-4" />
        <h3 class="mb-2 font-semibold">主题</h3>
        <p class="mb-4">{{ preview.subject }}</p>
        <h3 class="mb-2 font-semibold">正文</h3>
        <iframe
          v-if="form.format === 'html'"
          title="预览正文"
          sandbox=""
          :srcdoc="htmlPreview"
          class="h-[60vh] w-full border-0 bg-white"
        ></iframe>
        <p v-else class="whitespace-pre-wrap break-words">{{ preview.body }}</p>
      </div>
    </Drawer>
  </Modal>
</template>
