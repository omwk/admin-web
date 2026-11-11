import { defineConfig } from '@vben/eslint-config';

export default defineConfig([
  {
    // 测试文件常在一个文件里注册多个桩组件（stub component），
    // 这条规则在那里只会产生噪音；产品代码仍然适用。
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', '**/*.spec.{ts,tsx}'],
    rules: { 'vue/one-component-per-file': 'off' },
  },
]);
