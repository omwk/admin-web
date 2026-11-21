import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  componentRegistry,
  FORBIDDEN_COMPONENT,
  resolveMenuComponent,
} from '../component-registry';
import backend from './fixtures/backend-seed-menus.json';

afterEach(() => vi.restoreAllMocks());

describe('menu component registry contract', () => {
  it('stores only shorthand keys and resolves every registered loader exactly', () => {
    for (const [key, loader] of Object.entries(componentRegistry)) {
      expect(key).toMatch(/^[\w-]+(?:\/[\w-]+)+$/);
      expect(key).not.toMatch(/\.vue$/);
      expect(loader).toBeTypeOf('function');
      expect(resolveMenuComponent(key)).toBe(key);
    }
  });

  it.each([
    'system/user/index',
    '/system/user/index',
    'system/user/index.vue',
    '/system/user/index.vue',
    '///system/user/index.vue',
    '/views/system/user/index.vue',
    '/src/views/system/user/index.vue',
  ])('normalizes %s to the same explicit loader', (input) => {
    const key = resolveMenuComponent(input);
    expect(key).toBe('system/user/index');
    expect(componentRegistry[key]).toBe(componentRegistry['system/user/index']);
    expect(componentRegistry[key]).toBeTypeOf('function');
  });

  it.each([
    'system/user',
    'system/user/index/',
    'system/User/index',
    '../system/user/index.vue',
    '../../secret',
    'unregistered/index',
    'constructor',
    '__proto__',
    '',
    null,
    undefined,
  ])('renders forbidden and warns for %s without guessing a path', (input) => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(resolveMenuComponent(input)).toBe(FORBIDDEN_COMPONENT);
    expect(componentRegistry[FORBIDDEN_COMPONENT]).toBeTypeOf('function');
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      '[router] Unknown menu component:',
      input,
    );
  });

  it('resolves every backend seed page, including hidden and pending pages', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const pages = backend.menus.filter((menu) => menu.component !== null);
    expect(pages).toHaveLength(20);
    expect(pages.filter((menu) => !menu.visible)).toHaveLength(3);
    for (const { component } of pages) {
      const key = resolveMenuComponent(component);
      expect(key).toBe(component);
      expect(key).not.toBe(FORBIDDEN_COMPONENT);
      expect(componentRegistry[key]).toBeTypeOf('function');
    }
    expect(warn).not.toHaveBeenCalled();
  });
});
