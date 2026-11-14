import type { MenuRecordRaw } from '@vben/types';

import { describe, expect, it } from 'vitest';

import { homeShortcuts } from '../shortcuts';

describe('home shortcuts', () => {
  it('uses only visible permitted leaf menus, removing duplicates and limiting to six', () => {
    const menus: MenuRecordRaw[] = [
      { path: '/home', name: '首页' },
      {
        path: '/hidden',
        name: 'Hidden',
        show: false,
        children: [{ path: '/hidden/child', name: 'Child' }],
      },
      { path: '/disabled', name: 'Disabled', disabled: true },
      { path: '/__external/1', name: 'External' },
      { path: 'https://example.com', name: 'Remote' },
      {
        path: '/system',
        name: 'System',
        children: Array.from({ length: 8 }, (_, index) => ({
          path: `/system/page-${index}`,
          name: `Page ${index}`,
        })),
      },
      { path: '/system/page-0', name: 'Duplicate' },
    ];
    expect(homeShortcuts(menus).map((menu) => menu.path)).toEqual(
      Array.from({ length: 6 }, (_, index) => `/system/page-${index}`),
    );
    expect(homeShortcuts([])).toEqual([]);
  });
});
