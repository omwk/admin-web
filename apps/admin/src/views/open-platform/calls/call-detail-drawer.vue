<script setup lang="ts">
import type { GatewayCall } from '#/api/model/gateway';

import { Descriptions, Drawer, Tag, Typography } from 'ant-design-vue';

import { formatDateTime } from '#/utils/datetime';

import { formatGatewayCost } from '../shared/gateway-time';

defineProps<{ call?: GatewayCall; open: boolean }>();
const emit = defineEmits<{ close: [] }>();
</script>

<template>
  <Drawer :open="open" title="调用详情" :width="560" @close="emit('close')">
    <Descriptions v-if="call" :column="1" bordered size="small">
      <Descriptions.Item label="Trace ID">
        <Typography.Text copyable class="break-all font-mono">
          {{ call.trace_id }}
        </Typography.Text>
      </Descriptions.Item>
      <Descriptions.Item label="调用时间">
        {{ formatDateTime(call.called_at) }}
      </Descriptions.Item>
      <Descriptions.Item label="状态码">
        <Tag :color="call.status_code >= 400 ? 'red' : 'green'">
          {{ call.status_code }}
        </Tag>
      </Descriptions.Item>
      <Descriptions.Item label="耗时">
        {{ call.latency_ms }} ms
      </Descriptions.Item>
      <Descriptions.Item label="错误码">
        {{ call.error_code ?? '—' }}
      </Descriptions.Item>
      <Descriptions.Item label="计费模式">
        {{
          call.billing_mode === 'per_call'
            ? '按量计费'
            : call.billing_mode === 'package'
              ? '套餐'
              : '免费'
        }}
      </Descriptions.Item>
      <Descriptions.Item label="计费单位">
        {{ call.cost_units }}
      </Descriptions.Item>
      <Descriptions.Item label="费用">
        {{ formatGatewayCost(call.cost_cents) }}
      </Descriptions.Item>
      <Descriptions.Item label="State">{{ call.state }}</Descriptions.Item>
    </Descriptions>
  </Drawer>
</template>
