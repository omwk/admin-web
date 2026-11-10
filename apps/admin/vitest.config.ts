import { fileURLToPath } from 'node:url';

// eslint-disable-next-line n/no-extraneous-import -- Shared test tooling is declared in the workspace root.
import vue from '@vitejs/plugin-vue';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: { '#': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'happy-dom',
    include: ['src/**/__tests__/*.test.ts'],
    restoreMocks: true,
  },
});
