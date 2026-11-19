<script setup lang="ts">
import type { NotificationPreferenceView } from '#/api/model/notification';

import { computed } from 'vue';
import { RouterLink } from 'vue-router';

import { Button, Switch, Tag, Tooltip } from 'ant-design-vue';

const props = defineProps<{
  value: NotificationPreferenceView;
  saving: boolean;
  label: string;
}>();
const emit = defineEmits<{ change: [boolean]; customize: [] }>();
const unavailableReasons: Record<string, string> = {
  not_configured: '尚未配置通知方式',
  not_verified: '通知方式尚未验证，请先测试',
  missing_email: '账号尚未填写邮箱',
  disabled: '通知方式已停用',
};
const reason = computed(() => {
  if (!props.value.available)
    return unavailableReasons[props.value.reason] || '当前通知方式不可用';
  if (props.value.transactional && props.value.channel === 'email')
    return '安全邮件（验证/重置/邀请）不可关闭';
  return '';
});
</script>

<template>
  <div
    :data-preference="`${value.template}:${value.channel}`"
    :class="{ 'text-gray-400': value.inherited }"
  >
    <template v-if="!value.available">
      <Tag>未配置</Tag>
      <RouterLink to="/profile/notifications" class="text-primary">
        去配置
      </RouterLink>
      <div class="mt-2 text-xs text-gray-500">{{ reason }}</div>
      <div
        v-if="value.transactional && value.channel === 'email'"
        class="mt-2 text-xs text-gray-500"
      >
        安全邮件（验证/重置/邀请）不可关闭
      </div>
    </template>
    <template v-else>
      <Tooltip :title="reason">
        <span>
          <Switch
            :checked="
              value.transactional && value.channel === 'email'
                ? true
                : value.enabled
            "
            :disabled="saving || value.transactional || value.inherited"
            :aria-label="`${value.name || value.template} ${label}`"
            @change="(checked) => emit('change', Boolean(checked))"
          />
        </span>
      </Tooltip>
      <div v-if="reason" class="mt-2 text-xs text-gray-500">{{ reason }}</div>
      <div
        v-else-if="value.inherited && !value.transactional"
        class="mt-2 text-xs"
      >
        继承租户设置
        <Button
          type="link"
          size="small"
          :disabled="saving"
          @click="emit('customize')"
        >
          自定义
        </Button>
      </div>
      <div v-else-if="!value.transactional" class="mt-2 text-xs text-gray-500">
        个人设置
      </div>
    </template>
  </div>
</template>
