<script setup lang="ts">
import type { NotificationPreferenceView } from '#/api/model/notification';

import { computed } from 'vue';

import { Button, Switch, Tooltip } from 'ant-design-vue';

const props = defineProps<{
  value: NotificationPreferenceView;
  saving: boolean;
  label: string;
}>();
const emit = defineEmits<{ change: [boolean]; customize: [] }>();
const reason = computed(() => {
  if (props.value.transactional) return '安全邮件（验证/重置/邀请）不可关闭';
  if (!props.value.available) return props.value.reason || '当前渠道不可用';
  return '';
});
</script>

<template>
  <div
    :data-preference="`${value.template}:${value.channel}`"
    :class="{ 'text-gray-400': value.inherited }"
  >
    <Tooltip :title="reason">
      <span>
        <Switch
          :checked="value.enabled"
          :disabled="saving || !!reason || value.inherited"
          :aria-label="`${value.name || value.template} ${label}`"
          @change="(checked) => emit('change', Boolean(checked))"
        />
      </span>
    </Tooltip>
    <div v-if="reason" class="mt-2 text-xs text-gray-500">{{ reason }}</div>
    <div v-else-if="value.inherited" class="mt-2 text-xs">
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
    <div v-else class="mt-2 text-xs text-gray-500">个人设置</div>
  </div>
</template>
