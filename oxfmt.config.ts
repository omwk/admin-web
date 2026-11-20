import { oxfmtConfig } from '@vben/oxfmt-config';

import { defineConfig } from 'oxfmt';

export default defineConfig({
  ...oxfmtConfig,
  overrides: [
    ...(oxfmtConfig.overrides ?? []),
    {
      // Keep Ant Design component boundaries consistent with Vue's newline rules.
      files: [
        'apps/admin/src/views/system/storage/*.vue',
        'apps/admin/src/views/system/files/*.vue',
      ],
      options: { htmlWhitespaceSensitivity: 'ignore' },
    },
  ],
  ignorePatterns: [
    'dist',
    'dev-dist',
    '.local',
    '.claude',
    '.agent',
    '.agents',
    '.codex',
    '.output.js',
    'node_modules',
    '.nvmrc',
    'coverage',
    'CODEOWNERS',
    '.nitro',
    '.output',
    '**/*.svg',
    '**/*.sh',
    'public',
    '.npmrc',
    '*-lock.yaml',
    'skills-lock.json',
  ],
});
