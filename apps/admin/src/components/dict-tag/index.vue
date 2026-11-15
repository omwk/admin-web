<script setup lang="ts">
import type { DictionaryValue } from '#/composables/use-meta-dictionary';

import { Tag } from 'ant-design-vue';

import { useMetaDictionary } from '#/composables/use-meta-dictionary';

const props = withDefaults(
  defineProps<{
    showDot?: boolean;
    size?: 'default' | 'large' | 'small';
    type: string;
    value?: DictionaryValue;
  }>(),
  { showDot: false, size: 'default', value: undefined },
);

const dictionary = useMetaDictionary(() => props.type);
</script>

<template>
  <Tag
    :color="dictionary.color(value)"
    :class="{
      'text-xs leading-4': size === 'small',
      'text-base leading-6': size === 'large',
    }"
  >
    <span
      v-if="showDot"
      aria-hidden="true"
      class="mr-1 inline-block h-1.5 w-1.5 rounded-full bg-current"
    ></span>
    {{ dictionary.label(value) }}
  </Tag>
</template>
